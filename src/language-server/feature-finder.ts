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

import {Attribute, Document, Element, isPositionInsideRange, Method, ParsedCssDocument, ParsedHtmlDocument, Property, SourcePosition, SourceRange} from 'polymer-analyzer';
import {CssCustomPropertyAssignment, CssCustomPropertyUse} from 'polymer-analyzer/lib/css/css-custom-property-scanner';
import {Analysis} from 'polymer-analyzer/lib/model/analysis';
import {DatabindingExpression} from 'polymer-analyzer/lib/polymer/expression-scanner';

import {AstLocation, getCssAstLocationForPosition, getHtmlAstLocationForPosition} from '../ast-from-source-position';

import {LsAnalyzer} from './analyzer-synchronizer';


export interface FoundFeature {
  /**
   * The containing document, which in the case of inline documents, may not be
   * the document you started with!
   */
  document: Document;
  feature: Element|Property|Attribute|DatabindingFeature|
      CssCustomPropertyAssignment|CssCustomPropertyUse;
}

/**
 * Class responsible for describing the object at a given location in a
 * document.
 */
export default class FeatureFinder {
  constructor(private analyzer: LsAnalyzer) {
  }

  /**
   * Given a point in a file, return a high level feature that describes what
   * is going on there, like an Element for an HTML tag.
   */
  async getFeatureAt(
      url: string, position: SourcePosition,
      analysis?: Analysis): Promise<FoundFeature|undefined> {
    const location =
        await this.getAstLocationAtPositionAndPath(url, position, analysis);
    if (!location) {
      return;
    }
    return this.getFeatureForAstLocation(location, position);
  }

  /**
   * Given an AstLocation, return a high level feature.
   */
  getFeatureForAstLocation(
      astWrapperLocation: AstLocation, position: SourcePosition): FoundFeature
      |undefined {
    if (astWrapperLocation.language === 'css') {
      const {document, node} = astWrapperLocation;
      const cssFeatures =
          new Set<CssCustomPropertyAssignment|CssCustomPropertyUse>([
            ...document.getFeatures({kind: 'css-custom-property-assignment'}),
            ...document.getFeatures({kind: 'css-custom-property-use'})
          ]);
      const nodeRange = document.parsedDocument.sourceRangeForNode(node);
      if (!nodeRange) {
        return;
      }
      for (const feature of cssFeatures) {
        if (isContained(feature.sourceRange, nodeRange)) {
          return {document, feature};
        }
      }
      return;
    }
    const document = astWrapperLocation.document;
    const htmlLocation = astWrapperLocation.node;
    if (htmlLocation.kind === 'tagName') {
      const feature = getOnly(document.getFeatures({
        kind: 'element',
        id: htmlLocation.element.nodeName,
        imported: true,
        externalPackages: true
      }));
      if (feature) {
        return {document, feature};
      }
      return;
    } else if (htmlLocation.kind === 'attribute') {
      const elements = document.getFeatures({
        kind: 'element',
        id: htmlLocation.element.nodeName,
        imported: true,
        externalPackages: true
      });
      if (elements.size === 0) {
        return;
      }

      const feature = concatMap(elements, (el) => el.attributes.values())
                          .find(at => at.name === htmlLocation.attribute);
      if (feature) {
        return {document, feature};
      }
      return;
    } else if (
        htmlLocation.kind === 'attributeValue' ||
        htmlLocation.kind === 'text') {
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
                  return {
                    feature: new DatabindingFeature(
                        element, databinding, prop.name, prop.sourceRange),
                    document
                  };
                }
              }
              return {
                feature: new DatabindingFeature(
                    element, databinding, undefined, undefined),
                document
              };
            }
          }
        }
      }
    }
  }

  async getAstAtPosition(document: Document, position: SourcePosition):
      Promise<AstLocation|undefined> {
    const parsedDocument = document.parsedDocument;
    if (parsedDocument instanceof ParsedHtmlDocument) {
      const node = getHtmlAstLocationForPosition(parsedDocument, position);
      // The position is in an inline style tag, so we need to get its
      // Document and recurse through into it to find the best match.
      if (node && node.kind === 'styleTagContents' && node.textNode) {
        const cssDocuments = document.getFeatures({kind: 'css-document'});
        const styleElement = node.textNode.parentNode;
        for (const cssDocument of cssDocuments) {
          if (cssDocument.astNode === styleElement) {
            return this.getAstAtPosition(cssDocument, position);
          }
        }
      }
      return {language: 'html', document, node};
    } else if (parsedDocument instanceof ParsedCssDocument) {
      return {
        language: 'css',
        document,
        node: getCssAstLocationForPosition(parsedDocument, position)
      };
    }
  }

  async getAstLocationAtPositionAndPath(
      url: string, position: SourcePosition,
      analysis?: Analysis): Promise<AstLocation|undefined> {
    analysis =
        analysis || await this.analyzer.analyze([url], 'get AST location');
    const result = analysis.getDocument(url);
    if (!result.successful) {
      return;
    }
    return this.getAstAtPosition(result.value, position);
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

function isContained(inner: SourceRange, outer: SourceRange) {
  return isPositionInsideRange(inner.start, outer, true) &&
      isPositionInsideRange(inner.end, outer, true);
}
