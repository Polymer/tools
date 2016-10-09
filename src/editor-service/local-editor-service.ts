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

import {Analyzer, Options as AnalyzerOptions} from '../analyzer';
import {ParsedHtmlDocument} from '../html/html-document';
import {Document, Element, Property, ScannedProperty, SourceRange} from '../model/model';
import {Warning, WarningCarryingException} from '../warning/warning';

import {getLocationInfoForPosition} from './ast-from-source-position';
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
                undefined
          };
        })
      };
    } else if (location.kind === 'attribute') {
      const elements = document.getById('element', location.element.nodeName);
      let attributes: AttributeCompletion[] = [];
      for (const element of elements) {
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
