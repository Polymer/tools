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

import * as dom5 from 'dom5';
import * as espree from 'espree';
import * as estree from 'estree';
import * as parse5 from 'parse5';

import {HtmlVisitor, ParsedHtmlDocument} from '../html/html-document';
import {HtmlScanner} from '../html/html-scanner';
import {baseParseOptions} from '../javascript/javascript-parser';
import {ScannedFeature, SourceRange} from '../model/model';
import {Warning} from '../warning/warning';

const p = dom5.predicates;
const isTemplate = p.hasTagName('template');

const isDataBindingTemplate = p.AND(
    isTemplate,
    p.OR(
        p.hasAttrValue('is', 'dom-bind'),
        p.hasAttrValue('is', 'dom-if'),
        p.hasAttrValue('is', 'dom-repeat'),
        p.parentMatches(p.OR(
            p.hasTagName('dom-bind'),
            p.hasTagName('dom-if'),
            p.hasTagName('dom-repeat'),
            p.hasTagName('dom-module')))));

export interface Template extends parse5.ASTNode { content: parse5.ASTNode; }

export function getAllDataBindingTemplates(node: parse5.ASTNode) {
  return dom5.queryAll(
      node,
      isDataBindingTemplate,
      [],
      dom5.childNodesIncludeTemplate) as Template[];
}


/**
 * Databinding into an attribute/property.
 */
export class ScannedAttributeExpression implements ScannedFeature {
  /** The element whose attribute is being assigned to.*/
  astNode: parse5.ASTNode;
  /** The HTML element attribute that's being assigned to.*/
  attribute: parse5.ASTAttribute;
  sourceRange: SourceRange;
  warnings: Warning[] = [];
  direction: '{'|'[';
  expressionText: string;
  expressionAst: estree.Program;

  /**
   * If this is a bidirectional data binding, and an event name was specified
   * (using ::eventName syntax), this is that event name.
   */
  eventName: string|undefined;

  constructor(
      astNode: parse5.ASTNode, attribute: parse5.ASTAttribute,
      sourceRange: SourceRange, direction: '{'|'[', expressionText: string,
      eventName: string|undefined) {
    this.astNode = astNode;
    this.attribute = attribute;
    this.sourceRange = sourceRange;
    this.direction = direction;
    this.expressionText = expressionText;
    this.eventName = eventName;
    this.expressionAst = espree.parse(
        expressionText,
        Object.assign({sourceType: 'script' as 'script'}, baseParseOptions));
  }
}

/**
 * Find and parse Polymer databinding expressions in HTML.
 *
 * TODO(rictic):
 *  - parse expressions inline in strings rather than entire attributes
 *  - parse expressions in text nodes
 *  - allow getting source ranges inside of a databinding expression.
 *  - surface parse errors in expressions as warnings.
 */
export class ExpressionScanner implements HtmlScanner {
  async scan(
      document: ParsedHtmlDocument, _: (visitor: HtmlVisitor) => Promise<void>):
      Promise<ScannedAttributeExpression[]> {
    const results: ScannedAttributeExpression[] = [];
    const dataBindingTemplates = getAllDataBindingTemplates(document.ast);
    for (const template of dataBindingTemplates) {
      dom5.nodeWalkAll(template.content, (node) => {
        if (node.attrs) {
          for (const attr of node.attrs) {
            if (!attr.value) {
              continue;
            }
            const oneWayMatch = attr.value.match(/^\s*\[\[\s*(.*?)\s*\]\]\s*$/);
            const bidiMatch = attr.value.match(/^\s*{{\s*(.*?)}}\s*$/);
            if (oneWayMatch) {
              const expressionText = oneWayMatch[1];
              results.push(new ScannedAttributeExpression(
                  node,
                  attr,
                  document.sourceRangeForAttributeValue(node, attr.name)!,
                  '[',
                  expressionText,
                  undefined));
            } else if (bidiMatch) {
              let expressionText = bidiMatch[1];
              const match = expressionText.match(/(.*)::(.*)/);
              let eventName = undefined;
              if (match) {
                expressionText = match[1];
                eventName = match[2];
              }
              results.push(new ScannedAttributeExpression(
                  node,
                  attr,
                  document.sourceRangeForAttributeValue(node, attr.name)!,
                  '{',
                  expressionText,
                  eventName));
            } else {
              continue;
            }
          }
        }

        return false;
      });
    }
    return results;
  }
}
