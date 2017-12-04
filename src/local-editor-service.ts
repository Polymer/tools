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
import {Analyzer, AnalyzerOptions, Attribute, Document, Element, isPositionInsideRange, Method, ParsedHtmlDocument, Property, SourcePosition, SourceRange} from 'polymer-analyzer';
import {DatabindingExpression} from 'polymer-analyzer/lib/polymer/expression-scanner';
import {InMemoryOverlayUrlLoader} from 'polymer-analyzer/lib/url-loader/overlay-loader';

import {AstLocation, getAstLocationForPosition} from './ast-from-source-position';
import Settings from './language-server/settings';

export interface Options extends AnalyzerOptions {
  // TODO(rictic): update tests, make this required.
  settings?: Settings;
}

/**
 * This class provides much of the core functionality of the language server.
 *
 * It's got a slightly weird name and API due to historical reasons. It will
 * soon be carved up into smaller, more focused classes.
 */
export class LocalEditorService {
  readonly analyzer: Analyzer;
  private urlLoader: InMemoryOverlayUrlLoader;
  constructor(options: Options) {
    let urlLoader = options.urlLoader;
    if (!(urlLoader instanceof InMemoryOverlayUrlLoader)) {
      this.urlLoader = new InMemoryOverlayUrlLoader(urlLoader);
    } else {
      this.urlLoader = urlLoader;
    }
    this.analyzer =
        new Analyzer(Object.assign({}, options, {urlLoader: this.urlLoader}));
  }

  async fileChanged(localPath: string, contents?: string): Promise<void> {
    if (contents !== undefined) {
      // Just used in tests, need to remove this.
      this.urlLoader.urlContentsMap.set(localPath, contents);
    }
    await this.analyzer.filesChanged([localPath]);
  }

  async getReferencesForFeatureAtPosition(
      localPath: string,
      position: SourcePosition): Promise<SourceRange[]|undefined> {
    const analysis = await this.analyzer.analyze([localPath]);
    const document = analysis.getDocument(localPath);
    if (!(document instanceof Document)) {
      return;
    }
    const location = await this.getAstAtPosition(document, position);
    if (!location) {
      return;
    }
    if (location.kind === 'tagName') {
      return [
        ...document.getFeatures({
          kind: 'element-reference',
          id: location.element.tagName!,
          externalPackages: true,
          imported: true
        })
      ].map(e => e.sourceRange);
    }
  }

  async getTypeaheadCompletionsAtPosition(
      localPath: string,
      position: SourcePosition): Promise<TypeaheadCompletion|undefined> {
    const analysis = await this.analyzer.analyze([localPath]);
    const document = analysis.getDocument(localPath);
    if (!(document instanceof Document)) {
      return;
    }
    const location = await this.getAstAtPosition(document, position);
    if (!location) {
      return;
    }
    const feature =
        await this.getFeatureForAstLocation(document, location, position);
    if (feature && (feature instanceof DatabindingFeature)) {
      const element = feature.element;
      return {
        kind: 'properties-in-polymer-databinding',
        properties:
            [...element.properties.values(), ...element.methods.values()]
                .map((p) => {
                  const sortPrefix = p.inheritedFrom ? 'ddd-' : 'aaa-';
                  return {
                    name: p.name,
                    description: p.description || '',
                    type: p.type,
                    sortKey: sortPrefix + p.name,
                    inheritedFrom: p.inheritedFrom
                  };
                })
                .sort(compareAttributeResults)
      };
    }
    if (location.kind === 'tagName' || location.kind === 'text') {
      const elements = [
        ...document.getFeatures(
            {kind: 'element', externalPackages: true, imported: true})
      ].filter(e => e.tagName);
      return {
        kind: 'element-tags',
        elements: elements.map(e => {
          const attributesSpace = e.attributes.size > 0 ? ' ' : '';
          return {
            tagname: e.tagName!,
            description: e.description,
            expandTo: location.kind === 'text' || location.kind === 'tagName' ?
                `<${e.tagName}${attributesSpace}></${e.tagName}>` :
                undefined,
            expandToSnippet:
                location.kind === 'text' || location.kind === 'tagName' ?
                this.generateAutoCompletionForElement(e) :
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
      const [outerElement] = document.getFeatures({
        kind: 'element',
        id: domModule.id,
        imported: true,
        externalPackages: true
      });
      if (!outerElement)
        return;
      const sortPrefixes = this.createSortPrefixes(outerElement);
      const [innerElement] = document.getFeatures({
        kind: 'element',
        id: location.element.nodeName,
        imported: true,
        externalPackages: true
      });
      if (!innerElement)
        return;
      const innerAttribute = innerElement.attributes.get(location.attribute);
      if (!innerAttribute)
        return;
      const attributeValue =
          dom5.getAttribute(location.element, innerAttribute.name)!;
      const hasDelimeters = /^\s*(\{\{|\[\[)/.test(attributeValue);
      const attributes = [...outerElement.properties.values()].map(p => {
        const sortKey = (sortPrefixes.get(p.inheritedFrom) || `ddd-`) + p.name;
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
      });
      return {
        kind: 'attribute-values',
        attributes: attributes.sort(compareAttributeResults)
      };
    }

    if (location.kind === 'attribute') {
      const [element] = document.getFeatures({
        kind: 'element',
        id: location.element.nodeName,
        externalPackages: true,
        imported: true
      });
      let attributes: AttributeCompletion[] = [];
      if (element) {
        const sortPrefixes = this.createSortPrefixes(element);
        attributes.push(...[...element.attributes.values()].map(p => {
          const sortKey =
              (sortPrefixes.get(p.inheritedFrom) || `ddd-`) + p.name;
          return {
            name: p.name,
            description: p.description || '',
            type: p.type,
            inheritedFrom: p.inheritedFrom, sortKey
          };
        }));

        attributes.push(...[...element.events.values()].map((e) => {
          const postfix = sortPrefixes.get(e.inheritedFrom) || 'ddd-';
          const sortKey = `eee-${postfix}on-${e.name}`;
          return {
            name: `on-${e.name}`,
            description: e.description || '',
            type: e.type || 'CustomEvent',
            inheritedFrom: e.inheritedFrom, sortKey
          };
        }));
      }
      return {
        kind: 'attributes',
        attributes: attributes.sort(compareAttributeResults)
      };
    }
  }

  private createSortPrefixes(element: Element): Map<string|undefined, string> {
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

  private generateAutoCompletionForElement(e: Element): string {
    let autocompletion = `<${e.tagName}`;
    let tabindex = 1;
    if (e.attributes.size > 0) {
      autocompletion += ` $${tabindex++}`;
    }
    autocompletion += `>`;
    if (e.slots.length === 1 && !e.slots[0]!.name) {
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
    const domModules =
        document.getFeatures({kind: 'dom-module', imported: false});
    for (const domModule of domModules) {
      if (isPositionInsideRange(
              elementSourcePosition,
              parsedDocument.sourceRangeForNode(domModule.node))) {
        return domModule;
      }
    }
  }

  /**
   * Given an AstLocation, return a high level feature.
   */
  private async getFeatureForAstLocation(
      document: Document, astLocation: AstLocation, position: SourcePosition):
      Promise<Element|Attribute|DatabindingFeature|undefined> {
    if (astLocation.kind === 'tagName') {
      return getOnly(document.getFeatures({
        kind: 'element',
        id: astLocation.element.nodeName,
        imported: true,
        externalPackages: true
      }));
    } else if (astLocation.kind === 'attribute') {
      const elements = document.getFeatures({
        kind: 'element',
        id: astLocation.element.nodeName,
        imported: true,
        externalPackages: true
      });
      if (elements.size === 0) {
        return;
      }

      return concatMap(elements, (el) => el.attributes.values())
          .find(at => at.name === astLocation.attribute);
    } else if (
        astLocation.kind === 'attributeValue' || astLocation.kind === 'text') {
      const domModules = document.getFeatures({kind: 'dom-module'});
      for (const domModule of domModules) {
        if (!domModule.id) {
          continue;
        }
        const elements = document.getFeatures({
          kind: 'polymer-element',
          id: domModule.id,
          imported: true,
          externalPackages: true
        });
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

  private async getAstAtPosition(document: Document, position: SourcePosition) {
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
    this.property = element.properties.get(propertyName!) ||
        element.methods.get(propertyName!);
  }
}


function concatMap<I, O>(inputs: Iterable<I>, f: (i: I) => Iterable<O>): O[] {
  let results: O[] = [];
  for (const input of inputs) {
    results.push(...f(input));
  }
  return results;
}

function getOnly<V>(set: Set<V>) {
  if (set.size !== 1) {
    return undefined;
  }
  return set.values().next().value!;
}

function compareAttributeResults<
    A extends{sortKey: string, name: string, inheritedFrom?: string}>(
    a1: A, a2: A): number {
  let comparison = a1.sortKey.localeCompare(a2.sortKey);
  if (comparison !== 0) {
    return comparison;
  }
  comparison = (a1.inheritedFrom || '').localeCompare(a2.inheritedFrom || '');
  if (comparison !== 0) {
    return comparison;
  }
  return a1.name.localeCompare(a2.name);
}

export type TypeaheadCompletion = ElementCompletion | AttributesCompletion |
    AttributeValuesCompletion | DatabindingPropertiesCompletion;

/**
* When autocompleting somewhere that a new element tag could be added.
*/
export interface ElementCompletion {
  kind: 'element-tags';
  elements: IndividualElementCompletion[];
}

export interface IndividualElementCompletion {
  tagname: string;
  description: string;
  expandTo?: string;
  expandToSnippet?: string;
}

/**
* When autocompleting in the attributes section of an element, these are
* the attributes available.
*/
export interface AttributesCompletion {
  kind: 'attributes';
  attributes: AttributeCompletion[];
}

/**
* Describes an attribute.
*/
export interface AttributeCompletion {
  name: string;
  description: string;
  type: string|undefined;
  sortKey: string;
  inheritedFrom?: string;
}

/**
* When autocompleting inside of the value section of an attribute. i.e.
*   <div id="|"></div>
*/
export interface AttributeValuesCompletion {
  kind: 'attribute-values';
  attributes: AttributeValueCompletion[];
}

export interface AttributeValueCompletion extends AttributeCompletion {
  /**
  * The text to insert in the value section.
  */
  autocompletion: string;
}

/**
* When autocompleting inside of a polymer databinding expression.
*/
export interface DatabindingPropertiesCompletion {
  kind: 'properties-in-polymer-databinding';
  properties: AttributeCompletion[];
}
