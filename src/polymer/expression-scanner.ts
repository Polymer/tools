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
 * A databinding expression.
 */
export class ScannedDatabindingExpression implements ScannedFeature {
  /**
   * If databinding into an attribute this is the element whose attribute is
   * assigned to. If databinding into a text node, this is that text node.
   */
  readonly astNode: parse5.ASTNode;
  /**
 * If databindingInto is 'attribute' this will hold the HTML element
 * attribute that's being assigned to. Otherwise it's undefined.
 */
  readonly attribute: parse5.ASTAttribute|undefined;

  readonly sourceRange: SourceRange;
  readonly warnings: Warning[] = [];

  /** The databinding syntax used. */
  readonly direction: '{'|'[';
  readonly expressionText: string;
  readonly expressionAst: estree.Program;


  readonly databindingInto: 'string-interpolation'|'attribute';

  /**
   * If this is a two-way data binding, and an event name was specified
   * (using ::eventName syntax), this is that event name.
   */
  readonly eventName: string|undefined;

  constructor(
      astNode: parse5.ASTNode, attribute: parse5.ASTAttribute|undefined,
      sourceRange: SourceRange, direction: '{'|'[', expressionText: string,
      eventName: string|undefined,
      databindingInto: 'string-interpolation'|'attribute') {
    this.astNode = astNode;
    this.attribute = attribute;
    this.sourceRange = sourceRange;
    this.direction = direction;
    this.databindingInto = databindingInto;
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
 *  - more precise source ranges for databinding expressions
 *  - allow getting source ranges inside of a databinding expression.
 *  - surface parse errors in expressions as warnings.
 */
export class ExpressionScanner implements HtmlScanner {
  async scan(
      document: ParsedHtmlDocument, _: (visitor: HtmlVisitor) => Promise<void>):
      Promise<ScannedDatabindingExpression[]> {
    const results: ScannedDatabindingExpression[] = [];
    const dataBindingTemplates = getAllDataBindingTemplates(document.ast);
    for (const template of dataBindingTemplates) {
      dom5.nodeWalkAll(template.content, (node) => {
        if (dom5.isTextNode(node) && node.value) {
          const dataBindings = findDatabindingInString(node.value);
          for (const dataBinding of dataBindings) {
            results.push(new ScannedDatabindingExpression(
                node,
                undefined,
                document.sourceRangeForNode(node)!,
                dataBinding.direction,
                dataBinding.expressionText,
                undefined,
                'string-interpolation'));
          }
        }
        if (node.attrs) {
          for (const attr of node.attrs) {
            if (!attr.value) {
              continue;
            }
            const dataBindings = findDatabindingInString(attr.value);
            for (const dataBinding of dataBindings) {
              const isFullAttributeBinding = dataBinding.startIndex === 2 &&
                  dataBinding.endIndex + 2 === attr.value.length;
              const databindingInto =
                  isFullAttributeBinding ? 'attribute' : 'string-interpolation';
              let expressionText = dataBinding.expressionText;
              let eventName = undefined;
              if (dataBinding.direction === '{') {
                const match = expressionText.match(/(.*)::(.*)/);
                if (match) {
                  expressionText = match[1];
                  eventName = match[2];
                }
              }
              results.push(new ScannedDatabindingExpression(
                  node,
                  attr,
                  document.sourceRangeForAttributeValue(node, attr.name)!,
                  dataBinding.direction,
                  expressionText,
                  eventName,
                  databindingInto));
            }
          }
        }

        return false;
      });
    }
    return results;
  }
}

interface RawDatabinding {
  readonly expressionText: string;
  readonly startIndex: number;
  readonly endIndex: number;
  readonly direction: '{'|'[';
}
function findDatabindingInString(str: string) {
  const expressions: RawDatabinding[] = [];
  const openers = /{{|\[\[/g;
  let match;
  while (match = openers.exec(str)) {
    const matchedOpeners = match[0];
    const startIndex = match.index + 2;
    const direction = matchedOpeners === '{{' ? '{' : '[';
    const closers = matchedOpeners === '{{' ? '}}' : ']]';
    const endIndex = str.indexOf(closers, startIndex);
    if (endIndex === -1) {
      // No closers, this wasn't an expression after all.
      break;
    }
    const expressionText = str.slice(startIndex, endIndex);
    expressions.push({startIndex, endIndex, expressionText, direction});

    // Start looking for the next expression after the end of this one.
    openers.lastIndex = endIndex + 2;
  }
  return expressions;
}
