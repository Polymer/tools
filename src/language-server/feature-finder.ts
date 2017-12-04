/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {Analyzer, Attribute, Document, Element, isPositionInsideRange, Method, ParsedHtmlDocument, Property, SourcePosition, SourceRange} from 'polymer-analyzer';
import {DatabindingExpression} from 'polymer-analyzer/lib/polymer/expression-scanner';

import {AstLocation, getAstLocationForPosition} from '../ast-from-source-position';


/**
 * Class responsible for describing the object at a given location in a
 * document.
 */
export default class FeatureFinder {
  constructor(private analyzer: Analyzer) {
  }

  /**
   * Given a point in a file, return a high level feature that describes what
   * is going on there, like an Element for an HTML tag.
   */
  async getFeatureAt(localPath: string, position: SourcePosition):
      Promise<Element|Property|Attribute|DatabindingFeature|undefined> {
    const result = await this.getAstAtPositionAndPath(localPath, position);
    if (!result) {
      return;
    }
    const {location, document} = result;
    return this.getFeatureForAstLocation(document, location, position);
  }

  /**
   * Given an AstLocation, return a high level feature.
   */
  getFeatureForAstLocation(
      document: Document, astLocation: AstLocation, position: SourcePosition):
      Element|Attribute|DatabindingFeature|undefined {
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
                      element, databinding, prop.name, prop.sourceRange);
                }
              }
              return new DatabindingFeature(
                  element, databinding, undefined, undefined);
            }
          }
        }
      }
    }
  }

  async getAstAtPosition(document: Document, position: SourcePosition):
      Promise<AstLocation|undefined> {
    const parsedDocument = document.parsedDocument;
    if (!(parsedDocument instanceof ParsedHtmlDocument)) {
      return;
    }
    return getAstLocationForPosition(parsedDocument, position);
  }

  async getAstAtPositionAndPath(localPath: string, position: SourcePosition):
      Promise<{document: Document, location: AstLocation}|undefined> {
    const analysis = await this.analyzer.analyze([localPath]);
    const document = analysis.getDocument(localPath);
    if (!(document instanceof Document)) {
      return;
    }
    const location = await this.getAstAtPosition(document, position);
    if (!location) {
      return;
    }
    return {document, location};
  }
}


export class DatabindingFeature {
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
  propertyRange: SourceRange|undefined;
  constructor(
      element: Element, expression: DatabindingExpression,
      propertyName: string|undefined, propertyRange: SourceRange|undefined) {
    this.element = element;
    this.expression = expression;
    this.propertyName = propertyName;
    this.property = element.properties.get(propertyName!) ||
        element.methods.get(propertyName!);
    this.propertyRange = propertyRange;
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
