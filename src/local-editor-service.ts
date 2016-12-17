/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 */
import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import {Analyzer, Options as AnalyzerOptions} from 'polymer-analyzer';
import {ParsedHtmlDocument} from 'polymer-analyzer/lib/html/html-document';
import {Document, Element, Property, ScannedProperty, SourceRange} from 'polymer-analyzer/lib/model/model';
import {Warning, WarningCarryingException} from 'polymer-analyzer/lib/warning/warning';

import {getLocationInfoForPosition, isPositionInsideRange} from './ast-from-source-position';
import {AttributeCompletion, EditorService, SourcePosition, TypeaheadCompletion} from './editor-service';

export class LocalEditorService extends EditorService {
  private _analyzer: Analyzer;
  constructor(options: AnalyzerOptions) {
    super();
    this._analyzer = new Analyzer(options);
  }

  async fileChanged(localPath: string, contents?: string): Promise<void> {
    await this._analyzer.analyze(localPath, contents);
  }

  async getDocumentationAtPosition(localPath: string, position: SourcePosition):
      Promise<string|undefined> {
    const feature = await this._getFeatureAt(localPath, position);
    if (!feature) {
      return;
    }
    if (isProperty(feature)) {
      if (feature.type) {
        return `{${feature.type}} ${feature.description}`;
      }
    }
    return feature.description;
  }

  async getDefinitionForFeatureAtPosition(
      localPath: string,
      position: SourcePosition): Promise<SourceRange|undefined> {
    const feature = await this._getFeatureAt(localPath, position);
    if (!feature) {
      return;
    }
    return feature.sourceRange;
  }

  async getReferencesForFeatureAtPosition(
      localPath: string,
      position: SourcePosition): Promise<SourceRange[]|undefined> {
    const document = await this._analyzer.analyze(localPath);
    const location = await this._getLocationResult(document, position);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName') {
      return Array
          .from(
              document.getById('element-reference', location.element.tagName!))
          .map(e => e.sourceRange);
    }
  }

  async getTypeaheadCompletionsAtPosition(
      localPath: string,
      position: SourcePosition): Promise<TypeaheadCompletion|undefined> {
    const document = await this._analyzer.analyze(localPath);
    const location = await this._getLocationResult(document, position);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName' || location.kind === 'text') {
      const elements =
          Array.from(document.getByKind('element')).filter(e => e.tagName);
      return {
        kind: 'element-tags',
        elements: elements.map(e => {
          const attributesSpace = e.attributes.length > 0 ? ' ' : '';
          return {
            tagname: e.tagName!,
            description: e.description,
            expandTo: location.kind === 'text' ?
                `<${e.tagName}${attributesSpace}></${e.tagName}>` :
                undefined,
            expandToSnippet: location.kind === 'text' ?
                this._generateAutoCompletionForElement(e) :
                undefined
          };
        })
      };
    }

    if (location.kind === 'attributeValue') {
      const domModule =
          this.getAncestorDomModuleForElement(document, location.element);
      if (!domModule || !domModule.id)
        return;
      const outerElement = document.getOnlyAtId('element', domModule.id);
      if (!outerElement)
        return;
      const sortPrefixes = this._createSortPrefixes(outerElement);
      const innerElement =
          document.getOnlyAtId('element', location.element.nodeName);
      if (!innerElement)
        return;
      const innerAttribute = innerElement.attributes.find(
          (value) => value.name === location.attribute);
      if (!innerAttribute)
        return;
      const attributeValue =
          dom5.getAttribute(location.element, innerAttribute.name)!;
      const hasDelimeters = /^\s*(\{\{|\[\[)/.test(attributeValue);
      return {
        kind: 'attribute-values',
        attributes: outerElement.properties.map(p => {
          const sortKey =
              (sortPrefixes.get(p.inheritedFrom) || `ddd-`) + p.name;
          let autocompletion: string;
          if (attributeValue && hasDelimeters) {
            autocompletion = p.name;
          } else {
            if (innerAttribute.changeEvent) {
              autocompletion = `{{${p.name}}}`;
            } else {
              autocompletion = `[[${p.name}]]`;
            }
          }
          return {
            name: p.name,
            description: p.description || '',
            type: p.type,
            autocompletion: autocompletion,
            inheritedFrom: p.inheritedFrom, sortKey
          };
        })
      };
    }

    if (location.kind === 'attribute') {
      const elements = document.getById('element', location.element.nodeName);
      let attributes: AttributeCompletion[] = [];
      for (const element of elements) {
        const sortPrefixes = this._createSortPrefixes(element);
        const elementAttributes: AttributeCompletion[] =
            element.attributes.map(p => {
              const sortKey =
                  (sortPrefixes.get(p.inheritedFrom) || `ddd-`) + p.name;
              return {
                name: p.name,
                description: p.description || '',
                type: p.type,
                inheritedFrom: p.inheritedFrom, sortKey
              };
            });

        const eventAttributes: AttributeCompletion[] =
            element.events.map((e) => {
              const postfix = sortPrefixes.get(e.inheritedFrom) || 'ddd-';
              const sortKey = `eee-${postfix}on-${e.name}`;
              return {
                name: `on-${e.name}`,
                description: e.description || '',
                type: e.type || 'CustomEvent',
                inheritedFrom: e.inheritedFrom, sortKey
              };
            });
        attributes =
            attributes.concat(elementAttributes).concat(eventAttributes);
      }
      return {kind: 'attributes', attributes};
    };
  }

  _createSortPrefixes(element: Element): Map<string|undefined, string> {
    // A map from the inheritedFrom to a sort prefix. Note that
    // `undefined` is a legal value for inheritedFrom.
    const sortPrefixes = new Map<string|undefined, string>();
    // Not inherited, that means local! Sort it early.
    sortPrefixes.set(undefined, 'aaa-');
    if (element.superClass) {
      sortPrefixes.set(element.superClass, 'bbb-');
    }
    if (element.extends) {
      sortPrefixes.set(element.extends, 'ccc-');
    }
    return sortPrefixes;
  }

  _generateAutoCompletionForElement(e: Element): string {
    let autocompletion = `<${e.tagName}`;
    let tabindex = 1;
    if (e.attributes.length) {
      autocompletion += ` $${tabindex++}`;
    }
    autocompletion += `>`;
    if (e.slots.length === 1 && !e.slots[0].name) {
      autocompletion += `$${tabindex++}`;
    } else {
      for (const slot of e.slots) {
        const tagTabIndex = tabindex++;
        const slotAttribute = slot.name ? ` slot="${slot.name}"` : '';
        autocompletion += '\n\t<${' + tagTabIndex + ':div}' + slotAttribute +
            '>$' + tabindex++ + '</${' + tagTabIndex + ':div}>';
      }
      if (e.slots.length) {
        autocompletion += '\n';
      }
    }
    return autocompletion + `</${e.tagName}>$0`;
  }

  private getAncestorDomModuleForElement(
      document: Document, element: parse5.ASTNode) {
    const parsedDocument = document.parsedDocument;
    if (!(parsedDocument instanceof ParsedHtmlDocument)) {
      return;
    }
    const elementSourcePosition =
        parsedDocument.sourceRangeForNode(element)!.start;
    const domModules = document.getByKind('dom-module');
    for (const domModule of domModules) {
      if (isPositionInsideRange(
              elementSourcePosition,
              parsedDocument.sourceRangeForNode(domModule.node))) {
        return domModule;
      }
    }
  }

  async getWarningsForFile(localPath: string): Promise<Warning[]> {
    try {
      const doc = await this._analyzer.analyze(localPath);
      return doc.getWarnings();
    } catch (e) {
      // This might happen if, e.g. `localPath` has a parse error. In that case
      // we can't construct a valid Document, but we might still be able to give
      // a reasonable warning.
      if (e instanceof WarningCarryingException) {
        const warnException: WarningCarryingException = e;
        return [warnException.warning];
      }
      throw e;
    }
  }

  async _clearCaches() {
    this._analyzer.clearCaches();
  }

  private async _getFeatureAt(localPath: string, position: SourcePosition):
      Promise<Element|Property|undefined> {
    const document = await this._analyzer.analyze(localPath);
    const location = await this._getLocationResult(document, position);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName') {
      return document.getOnlyAtId('element', location.element.nodeName);
    } else if (location.kind === 'attribute') {
      const elements = document.getById('element', location.element.nodeName);
      if (elements.size === 0) {
        return;
      }

      return concatMap(elements, (el) => el.attributes)
          .find(at => at.name === location.attribute);
    }
  }

  private async _getLocationResult(
      document: Document, position: SourcePosition) {
    const parsedDocument = document.parsedDocument;
    if (!(parsedDocument instanceof ParsedHtmlDocument)) {
      return;
    }
    return getLocationInfoForPosition(parsedDocument, position);
  }
}



function isProperty(d: any): d is(ScannedProperty | Property) {
  return 'type' in d;
}

function concatMap<I, O>(inputs: Iterable<I>, f: (i: I) => O[]): O[] {
  let results: O[] = [];
  for (const input of inputs) {
    results = results.concat(f(input));
  }
  return results;
}
