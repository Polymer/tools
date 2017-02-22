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
import * as estree from 'estree';
import * as parse5 from 'parse5';

import {ParsedHtmlDocument} from '../html/html-document';
import {parseJs} from '../javascript/javascript-parser';
import {correctSourceRange, LocationOffset, SourceRange} from '../model/model';
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

/**
 * Given a node, return all databinding templates inside it.
 *
 * A template is "databinding" if polymer databinding expressions are expected
 * to be evaluated inside. e.g. <template is='dom-if'> or <dom-module><template>
 *
 * Results include both direct and nested templates (e.g. dom-if inside
 * dom-module).
 */
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
export class DatabindingExpression {
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

  private readonly locationOffset: LocationOffset;

  constructor(
      astNode: parse5.ASTNode, attribute: parse5.ASTAttribute|undefined,
      sourceRange: SourceRange, direction: '{'|'[', expressionText: string,
      eventName: string|undefined,
      databindingInto: 'string-interpolation'|'attribute',
      ast: estree.Program) {
    this.astNode = astNode;
    this.attribute = attribute;
    this.sourceRange = sourceRange;
    this.direction = direction;
    this.databindingInto = databindingInto;
    this.expressionText = expressionText;
    this.expressionAst = ast;
    this.eventName = eventName;
    this.locationOffset = {
      line: sourceRange.start.line,
      col: sourceRange.start.column
    };
  }

  /**
   * Given an estree node in this databinding expression, give its source range.
   */
  sourceRangeForNode(node: estree.Node) {
    if (!node || !node.loc) {
      return;
    }
    const databindingRelativeSourceRange = {
      file: this.sourceRange.file,
      // Note: estree uses 1-indexed lines, but SourceRange uses 0 indexed.
      start: {line: (node.loc.start.line - 1), column: node.loc.start.column},
      end: {line: (node.loc.end.line - 1), column: node.loc.end.column}
    };
    return correctSourceRange(
        databindingRelativeSourceRange, this.locationOffset);
  }
}

/**
 * Find and parse Polymer databinding expressions in HTML.
 */
export function scanDocumentForExpressions(document: ParsedHtmlDocument) {
  return extractDataBindingsFromTemplates(
      document, getAllDataBindingTemplates(document.ast));
}

export function scanDatabindingTemplateForExpressions(
    document: ParsedHtmlDocument, template: Template) {
  return extractDataBindingsFromTemplates(
      document,
      [template].concat(getAllDataBindingTemplates(template.content)));
}

function extractDataBindingsFromTemplates(
    document: ParsedHtmlDocument, templates: Iterable<Template>) {
  const results: DatabindingExpression[] = [];
  const warnings: Warning[] = [];
  for (const template of templates) {
    dom5.nodeWalkAll(template.content, (node) => {
      if (dom5.isTextNode(node) && node.value) {
        extractDataBindingsFromTextNode(document, node, results, warnings);
      }
      if (node.attrs) {
        for (const attr of node.attrs) {
          extractDataBindingsFromAttr(document, node, attr, results, warnings);
        }
      }
      return false;
    });
  }
  return {expressions: results, warnings};
}

function extractDataBindingsFromTextNode(
    document: ParsedHtmlDocument,
    node: parse5.ASTNode,
    results: DatabindingExpression[],
    warnings: Warning[]) {
  const text = node.value || '';
  const dataBindings = findDatabindingInString(text);
  if (dataBindings.length === 0) {
    return;
  }
  const newlineIndexes = findNewlineIndexes(text);
  const nodeSourceRange = document.sourceRangeForNode(node);
  if (!nodeSourceRange) {
    return;
  }
  // We have indexes into the text node, we'll want to correct that so that
  // it's a range relative to the start of the document.
  const startOfTextNodeOffset: LocationOffset = {
    line: nodeSourceRange.start.line,
    col: nodeSourceRange.start.column
  };
  for (const dataBinding of dataBindings) {
    const sourceRangeWithinTextNode = indexesToSourceRange(
        dataBinding.startIndex,
        dataBinding.endIndex,
        nodeSourceRange.file,
        newlineIndexes);
    const sourceRange =
        correctSourceRange(sourceRangeWithinTextNode, startOfTextNodeOffset)!;

    const parseResult =
        parseExpression(dataBinding.expressionText, sourceRange);

    if (!parseResult) {
      continue;
    }
    if (parseResult.type === 'failure') {
      warnings.push(parseResult.warning);
    } else {
      results.push(new DatabindingExpression(
          node,
          undefined,
          sourceRange,
          dataBinding.direction,
          dataBinding.expressionText,
          undefined,
          'string-interpolation',
          parseResult.program));
    }

    ;
  }
}

function extractDataBindingsFromAttr(
    document: ParsedHtmlDocument,
    node: parse5.ASTNode,
    attr: parse5.ASTAttribute,
    results: DatabindingExpression[],
    warnings: Warning[]) {
  if (!attr.value) {
    return;
  }
  const dataBindings = findDatabindingInString(attr.value);
  const attributeValueRange =
      document.sourceRangeForAttributeValue(node, attr.name, true);
  if (!attributeValueRange) {
    return;
  }
  const attributeOffset: LocationOffset = {
    line: attributeValueRange.start.line,
    col: attributeValueRange.start.column
  };
  const newlineIndexes = findNewlineIndexes(attr.value);
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
    const sourceRangeWithinAttribute = indexesToSourceRange(
        dataBinding.startIndex,
        dataBinding.endIndex,
        attributeValueRange.file,
        newlineIndexes);
    const sourceRange =
        correctSourceRange(sourceRangeWithinAttribute, attributeOffset)!;
    const parseResult = parseExpression(expressionText, sourceRange);
    if (!parseResult) {
      continue;
    }
    if (parseResult.type === 'failure') {
      warnings.push(parseResult.warning);
    } else {
      results.push(new DatabindingExpression(
          node,
          attr,
          sourceRange,
          dataBinding.direction,
          expressionText,
          eventName,
          databindingInto,
          parseResult.program));
    }
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

function findNewlineIndexes(str: string) {
  const indexes = [];
  let prev;
  let index = str.indexOf('\n');
  while (index !== -1) {
    indexes.push(index);
    prev = index;
    index = str.indexOf('\n', prev + 1);
  }
  return indexes;
}

function indexesToSourceRange(
    startIndex: number,
    endIndex: number,
    filename: string,
    newlineIndexes: number[]): SourceRange {
  let startLineNumLinesIntoText = 0;
  let startOfLineIndex = 0;
  let endLineNumLinesIntoText = 0;
  let endOfLineIndex = 0;
  for (const index of newlineIndexes) {
    if (index < startIndex) {
      startLineNumLinesIntoText++;
      startOfLineIndex = index + 1;
    }
    if (index < endIndex) {
      endLineNumLinesIntoText++;
      endOfLineIndex = index + 1;
    } else {
      // Nothing more interesting to do.
      break;
    }
  }
  return {
    file: filename,
    start: {
      line: startLineNumLinesIntoText,
      column: startIndex - startOfLineIndex
    },
    end: {line: endLineNumLinesIntoText, column: endIndex - endOfLineIndex}
  };
}

function parseExpression(content: string, expressionSourceRange: SourceRange) {
  const expressionOffset = {
    line: expressionSourceRange.start.line,
    col: expressionSourceRange.start.column
  };
  const parseResult = parseJs(
      content,
      expressionSourceRange.file,
      expressionOffset,
      'polymer-expression-parse-error');
  if (parseResult.type === 'success') {
    return parseResult;
  }
  // The polymer databinding expression language allows for foo.0 and foo.*
  // formats when accessing sub properties. These aren't valid JS, but we don't
  // want to warn for them either. So just return undefined for now.
  if (/\.(\*|\d+)/.test(content)) {
    return undefined;
  }
  return parseResult;
}
