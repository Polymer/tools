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
import {Analyzer, AnalyzerOptions, Attribute, Document, Element, isPositionInsideRange, Method, ParsedHtmlDocument, Property, ScannedProperty, SourcePosition, SourceRange, Warning} from 'polymer-analyzer';
import {DatabindingExpression} from 'polymer-analyzer/lib/polymer/expression-scanner';
import {Linter, registry, Rule} from 'polymer-linter';
import {ProjectConfig} from 'polymer-project-config';

import {AstLocation, getAstLocationForPosition} from './ast-from-source-position';
import {AttributeCompletion, EditorService, TypeaheadCompletion} from './editor-service';

export interface Options extends AnalyzerOptions { polymerJsonPath?: string; }

/**
 * An in-process implementation of EditorService.
 *
 * This should be run out-of-process of any user interface work. See
 * RemoteEditorService if you're running in-process with an editor, as it
 * has the same interface but is actually running a LocalEditorService in
 * another process.
 */
export class LocalEditorService extends EditorService {
  private readonly _analyzer: Analyzer;
  private readonly _linter: Linter;
  constructor(options: Options) {
    super();
    this._analyzer = new Analyzer(options);
    // TODO(rictic): watch for changes of polymer.json
    let rules: Set<Rule> = new Set();
    if (options.polymerJsonPath) {
      let config = null;
      try {
        config = ProjectConfig.loadConfigFromFile(options.polymerJsonPath);
      } catch (_) {
        // TODO(rictic): warn about the error
      }
      if (config && config.lint && config.lint.rules) {
        try {
          rules = registry.getRules(config.lint.rules);
        } catch (_) {
          // TODO(rictic): warn about the bad rule
        }
      }
    }
    this._linter = new Linter(rules, this._analyzer);
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
    if (feature instanceof DatabindingFeature) {
      return feature.property && feature.property.description;
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
    if (feature instanceof DatabindingFeature) {
      return feature.property && feature.property.sourceRange;
    }
    return feature.sourceRange;
  }

  async getReferencesForFeatureAtPosition(
      localPath: string,
      position: SourcePosition): Promise<SourceRange[]|undefined> {
    const document = await this._analyzer.analyze(localPath);
    const location = await this._getAstAtPosition(document, position);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName') {
      return Array
          .from(document.getById(
              'element-reference', location.element.tagName!,
              {externalPackages: true, imported: true}))
          .map(e => e.sourceRange);
    }
  }

  async getTypeaheadCompletionsAtPosition(
      localPath: string,
      position: SourcePosition): Promise<TypeaheadCompletion|undefined> {
    const document = await this._analyzer.analyze(localPath);
    const location = await this._getAstAtPosition(document, position);
    if (!location) {
      return;
    }
    const feature =
        await this._getFeatureForAstLocation(document, location, position);
    if (feature && (feature instanceof DatabindingFeature)) {
      const element = feature.element;
      return {
        kind: 'properties-in-polymer-databinding',
        properties: element.properties.concat(element.methods).map((p) => {
          const sortPrefix = p.inheritedFrom ? 'ddd-' : 'aaa-';
          return {
            name: p.name,
            description: p.description || '',
            type: p.type,
            sortKey: sortPrefix + p.name,
            inheritedFrom: p.inheritedFrom
          };
        })
      };
    }
    if (location.kind === 'tagName' || location.kind === 'text') {
      const elements =
          Array
              .from(document.getByKind(
                  'element', {externalPackages: true, imported: true}))
              .filter(e => e.tagName);
      return {
        kind: 'element-tags',
        elements: elements.map(e => {
          const attributesSpace = e.attributes.length > 0 ? ' ' : '';
          return {
            tagname: e.tagName!,
            description: e.description,
            expandTo: location.kind === 'text' || location.kind === 'tagName' ?
                `<${e.tagName}${attributesSpace}></${e.tagName}>` :
                undefined,
            expandToSnippet:
                location.kind === 'text' || location.kind === 'tagName' ?
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
      const outerElement = document.getOnlyAtId(
          'element', domModule.id, {imported: true, externalPackages: true});
      if (!outerElement)
        return;
      const sortPrefixes = this._createSortPrefixes(outerElement);
      const innerElement = document.getOnlyAtId(
          'element', location.element.nodeName,
          {imported: true, externalPackages: true});
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
      const elements = document.getById(
          'element', location.element.nodeName,
          {externalPackages: true, imported: true});
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
      sortPrefixes.set(element.superClass.identifier, 'bbb-');
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
    const domModules = document.getByKind('dom-module', {imported: false});
    for (const domModule of domModules) {
      if (isPositionInsideRange(
              elementSourcePosition,
              parsedDocument.sourceRangeForNode(domModule.node))) {
        return domModule;
      }
    }
  }

  async getWarningsForFile(localPath: string): Promise<Warning[]> {
    return this._linter.lint([localPath]);
  }

  async getWarningsForPackage() {
    return this._linter.lintPackage();
  }

  async _clearCaches() {
    this._analyzer.clearCaches();
  }

  /**
   * Given a point in a file, return a high level feature that describes what
   * is going on there, like an Element for an HTML tag.
   */
  private async _getFeatureAt(localPath: string, position: SourcePosition):
      Promise<Element|Property|Attribute|DatabindingFeature|undefined> {
    const document = await this._analyzer.analyze(localPath);
    const location = await this._getAstAtPosition(document, position);
    if (!location) {
      return;
    }
    return this._getFeatureForAstLocation(document, location, position);
  }

  /**
   * Given an AstLocation, return a high level feature.
   */
  private async _getFeatureForAstLocation(
      document: Document, astLocation: AstLocation, position: SourcePosition):
      Promise<Element|Attribute|DatabindingFeature|undefined> {
    if (astLocation.kind === 'tagName') {
      return document.getOnlyAtId(
          'element', astLocation.element.nodeName,
          {imported: true, externalPackages: true});
    } else if (astLocation.kind === 'attribute') {
      const elements = document.getById(
          'element', astLocation.element.nodeName,
          {imported: true, externalPackages: true});
      if (elements.size === 0) {
        return;
      }

      return concatMap(elements, (el) => el.attributes)
          .find(at => at.name === astLocation.attribute);
    } else if (
        astLocation.kind === 'attributeValue' || astLocation.kind === 'text') {
      const domModules = document.getByKind('dom-module');
      for (const domModule of domModules) {
        if (!domModule.id) {
          continue;
        }
        const elements = document.getById(
            'polymer-element', domModule.id,
            {imported: true, externalPackages: true});
        if (elements.size !== 1) {
          continue;
        }
        const element = elements.values().next().value!;
        if (isPositionInsideRange(position, domModule.sourceRange)) {
          for (const databinding of domModule.databindings) {
            if (isPositionInsideRange(
                    position, databinding.sourceRange, true)) {
              for (const prop of databinding.properties) {
                if (isPositionInsideRange(position, prop.sourceRange, true)) {
                  return new DatabindingFeature(
                      element, databinding, prop.name);
                }
              }
              return new DatabindingFeature(element, databinding, undefined);
            }
          }
        }
      }
    }
  }

  private async _getAstAtPosition(
      document: Document, position: SourcePosition) {
    const parsedDocument = document.parsedDocument;
    if (!(parsedDocument instanceof ParsedHtmlDocument)) {
      return;
    }
    return getAstLocationForPosition(parsedDocument, position);
  }
}

class DatabindingFeature {
  /** The element contains the databinding expression. */
  element: Element;
  expression: DatabindingExpression;
  /**
   * If present, this represents a particular property on `element` that's
   * referenced in the databinding expression.
   */
  propertyName: string|undefined;
  /**
   * The property or method on Element corresponding to `propertyName` if
   * one could be found.
   */
  property: Property|Method|undefined;
  constructor(
      element: Element, expression: DatabindingExpression,
      propertyName: string|undefined) {
    this.element = element;
    this.expression = expression;
    this.propertyName = propertyName;
    this.property = element.properties.find((p) => p.name === propertyName) ||
        element.methods.find(m => m.name === propertyName);
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
