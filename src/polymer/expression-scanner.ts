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

import * as babel from 'babel-types';
import * as dom5 from 'dom5';
import * as parse5 from 'parse5';

import {ParsedHtmlDocument} from '../html/html-document';
import * as astValue from '../javascript/ast-value';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {parseJs} from '../javascript/javascript-parser';
import {correctSourceRange, LocationOffset, Severity, SourceRange, Warning} from '../model/model';
import {ParsedDocument} from '../parser/document';

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
             node, isDataBindingTemplate, [], dom5.childNodesIncludeTemplate) as
      Template[];
}

export type HtmlDatabindingExpression =
    TextNodeDatabindingExpression|AttributeDatabindingExpression;

/**
 * Some expressions are limited. For example, in a property declaration,
 * `observer` must be the identifier of a method, and `computed` must be a
 * function call expression.
 */
export type ExpressionLimitation = 'full'|'identifierOnly'|'callExpression';
export abstract class DatabindingExpression {
  readonly sourceRange: SourceRange;
  readonly warnings: Warning[] = [];
  readonly expressionText: string;

  private readonly _expressionAst: babel.Program;
  private readonly locationOffset: LocationOffset;
  private readonly _document: ParsedDocument;

  /**
   * Toplevel properties on the model that are referenced in this expression.
   *
   * e.g. in {{foo(bar, baz.zod)}} the properties are foo, bar, and baz
   * (but not zod).
   */
  properties: Array<{name: string, sourceRange: SourceRange}> = [];

  constructor(
      sourceRange: SourceRange, expressionText: string, ast: babel.Program,
      limitation: ExpressionLimitation, document: ParsedDocument) {
    this.sourceRange = sourceRange;
    this.expressionText = expressionText;
    this._expressionAst = ast;
    this.locationOffset = {
      line: sourceRange.start.line,
      col: sourceRange.start.column
    };
    this._document = document;
    this._extractPropertiesAndValidate(limitation);
  }

  /**
   * Given an estree node in this databinding expression, give its source range.
   */
  sourceRangeForNode(node: babel.Node) {
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

  private _extractPropertiesAndValidate(limitation: ExpressionLimitation) {
    if (this._expressionAst.body.length !== 1) {
      this.warnings.push(this._validationWarning(
          `Expected one expression, got ${this._expressionAst.body.length}`,
          this._expressionAst));
      return;
    }
    const expressionStatement = this._expressionAst.body[0]!;
    if (!babel.isExpressionStatement(expressionStatement)) {
      this.warnings.push(this._validationWarning(
          `Expect an expression, not a ${expressionStatement.type}`,
          expressionStatement));
      return;
    }
    let expression = expressionStatement.expression;

    this._validateLimitation(expression, limitation);
    if (babel.isUnaryExpression(expression) && expression.operator === '!') {
      expression = expression.argument;
    }
    this._extractAndValidateSubExpression(expression, true);
  }

  private _validateLimitation(
      expression: babel.Expression, limitation: ExpressionLimitation) {
    switch (limitation) {
      case 'identifierOnly':
        if (!babel.isIdentifier(expression)) {
          this.warnings.push(this._validationWarning(
              `Expected just a name here, not an expression`, expression));
        }
        break;
      case 'callExpression':
        if (!babel.isCallExpression(expression)) {
          this.warnings.push(this._validationWarning(
              `Expected a function call here.`, expression));
        }
        break;
      case 'full':
        break;  // no checks needed
      default:
        const never: never = limitation;
        throw new Error(`Got unknown limitation: ${never}`);
    }
  }

  private _extractAndValidateSubExpression(
      expression: babel.Node, callAllowed: boolean): void {
    if (babel.isUnaryExpression(expression) && expression.operator === '-') {
      if (!babel.isNumericLiteral(expression.argument)) {
        this.warnings.push(this._validationWarning(
            'The - operator is only supported for writing negative numbers.',
            expression));
        return;
      }
      this._extractAndValidateSubExpression(expression.argument, false);
      return;
    }
    if (babel.isLiteral(expression)) {
      return;
    }
    if (babel.isIdentifier(expression)) {
      this.properties.push({
        name: expression.name,
        sourceRange: this.sourceRangeForNode(expression)!
      });
      return;
    }
    if (babel.isMemberExpression(expression)) {
      this._extractAndValidateSubExpression(expression.object, false);
      return;
    }
    if (callAllowed && babel.isCallExpression(expression)) {
      this._extractAndValidateSubExpression(expression.callee, false);
      for (const arg of expression.arguments) {
        this._extractAndValidateSubExpression(arg, false);
      }
      return;
    }
    this.warnings.push(this._validationWarning(
        `Only simple syntax is supported in Polymer databinding expressions. ` +
            `${expression.type} not expected here.`,
        expression));
  }

  private _validationWarning(message: string, node: babel.Node): Warning {
    return new Warning({
      code: 'invalid-polymer-expression',
      message,
      sourceRange: this.sourceRangeForNode(node)!,
      severity: Severity.WARNING,
      parsedDocument: this._document,
    });
  }
}

export class AttributeDatabindingExpression extends DatabindingExpression {
  /**
   * The element whose attribute/property is assigned to.
   */
  readonly astNode: parse5.ASTNode;

  readonly databindingInto = 'attribute';

  /**
   * If true, this is databinding into the complete attribute. Polymer treats
   * such databindings specially, e.g. they're setting the property by default,
   * not the attribute.
   *
   * e.g.
   * foo="{{bar}}" is complete, foo="hello {{bar}} world" is not complete.
   *
   * An attribute may have multiple incomplete bindings. They will be separate
   * AttributeDatabindingExpressions.
   */
  readonly isCompleteBinding: boolean;

  /** The databinding syntax used. */
  readonly direction: '{'|'[';

  /**
   * If this is a two-way data binding, and an event name was specified
   * (using ::eventName syntax), this is that event name.
   */
  readonly eventName: string|undefined;

  /** The attribute we're databinding into. */
  readonly attribute: parse5.ASTAttribute;

  constructor(
      astNode: parse5.ASTNode, isCompleteBinding: boolean, direction: '{'|'[',
      eventName: string|undefined, attribute: parse5.ASTAttribute,
      sourceRange: SourceRange, expressionText: string, ast: babel.Program,
      document: ParsedHtmlDocument) {
    super(sourceRange, expressionText, ast, 'full', document);
    this.astNode = astNode;
    this.isCompleteBinding = isCompleteBinding;
    this.direction = direction;
    this.eventName = eventName;
    this.attribute = attribute;
  }
}

export class TextNodeDatabindingExpression extends DatabindingExpression {
  /** The databinding syntax used. */
  readonly direction: '{'|'[';

  /**
   * The HTML text node that contains this databinding.
   */
  readonly astNode: parse5.ASTNode;

  readonly databindingInto = 'text-node';

  constructor(
      direction: '{'|'[', astNode: parse5.ASTNode, sourceRange: SourceRange,
      expressionText: string, ast: babel.Program,
      document: ParsedHtmlDocument) {
    super(sourceRange, expressionText, ast, 'full', document);
    this.direction = direction;
    this.astNode = astNode;
  }
}

export class JavascriptDatabindingExpression extends DatabindingExpression {
  readonly astNode: babel.Node;

  readonly databindingInto = 'javascript';

  constructor(
      astNode: babel.Node, sourceRange: SourceRange, expressionText: string,
      ast: babel.Program, kind: ExpressionLimitation,
      document: JavaScriptDocument) {
    super(sourceRange, expressionText, ast, kind, document);
    this.astNode = astNode;
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
  const results: HtmlDatabindingExpression[] = [];
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
    results: HtmlDatabindingExpression[],
    warnings: Warning[]) {
  const text = node.value || '';
  const dataBindings = findDatabindingInString(text);
  if (dataBindings.length === 0) {
    return;
  }
  const nodeSourceRange = document.sourceRangeForNode(node);
  if (!nodeSourceRange) {
    return;
  }

  const startOfTextNodeOffset =
      document.sourcePositionToOffset(nodeSourceRange.start);
  for (const dataBinding of dataBindings) {
    const sourceRange = document.offsetsToSourceRange(
        dataBinding.startIndex + startOfTextNodeOffset,
        dataBinding.endIndex + startOfTextNodeOffset);

    const parseResult =
        parseExpression(dataBinding.expressionText, sourceRange);

    if (!parseResult) {
      continue;
    }
    if (parseResult.type === 'failure') {
      warnings.push(
          new Warning({parsedDocument: document, ...parseResult.warning}));
    } else {
      const expression = new TextNodeDatabindingExpression(
          dataBinding.direction,
          node,
          sourceRange,
          dataBinding.expressionText,
          parseResult.program,
          document);
      for (const warning of expression.warnings) {
        warnings.push(warning);
      }
      results.push(expression);
    }
  }
}

function extractDataBindingsFromAttr(
    document: ParsedHtmlDocument,
    node: parse5.ASTNode,
    attr: parse5.ASTAttribute,
    results: HtmlDatabindingExpression[],
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
  const attributeOffset =
      document.sourcePositionToOffset(attributeValueRange.start);
  for (const dataBinding of dataBindings) {
    const isFullAttributeBinding = dataBinding.startIndex === 2 &&
        dataBinding.endIndex + 2 === attr.value.length;
    let expressionText = dataBinding.expressionText;
    let eventName = undefined;
    if (dataBinding.direction === '{') {
      const match = expressionText.match(/(.*)::(.*)/);
      if (match) {
        expressionText = match[1];
        eventName = match[2];
      }
    }
    const sourceRange = document.offsetsToSourceRange(
        dataBinding.startIndex + attributeOffset,
        dataBinding.endIndex + attributeOffset);

    const parseResult = parseExpression(expressionText, sourceRange);
    if (!parseResult) {
      continue;
    }
    if (parseResult.type === 'failure') {
      warnings.push(
          new Warning({parsedDocument: document, ...parseResult.warning}));
    } else {
      const expression = new AttributeDatabindingExpression(
          node,
          isFullAttributeBinding,
          dataBinding.direction,
          eventName,
          attr,
          sourceRange,
          expressionText,
          parseResult.program,
          document);
      for (const warning of expression.warnings) {
        warnings.push(warning);
      }
      results.push(expression);
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

export function parseExpressionInJsStringLiteral(
    document: JavaScriptDocument,
    stringLiteral: babel.Node,
    kind: 'identifierOnly'|'callExpression'|'full') {
  const warnings: Warning[] = [];
  const result = {
    databinding: undefined as undefined | JavascriptDatabindingExpression,
    warnings
  };
  const sourceRangeForLiteral = document.sourceRangeForNode(stringLiteral)!;

  if (!babel.isLiteral(stringLiteral)) {
    // Should we warn here? It's potentially valid, just unanalyzable. Maybe
    // just an info that someone could escalate to a warning/error?
    warnings.push(new Warning({
      code: 'unanalyzable-polymer-expression',
      message: `Can only analyze databinding expressions in string literals.`,
      severity: Severity.INFO,
      sourceRange: sourceRangeForLiteral,
      parsedDocument: document
    }));
    return result;
  }
  const expressionText = astValue.expressionToValue(stringLiteral);
  if (typeof expressionText !== 'string') {
    warnings.push(new Warning({
      code: 'invalid-polymer-expression',
      message: `Expected a string, got a ${typeof expressionText}.`,
      sourceRange: sourceRangeForLiteral,
      severity: Severity.WARNING,
      parsedDocument: document
    }));
    return result;
  }
  const sourceRange: SourceRange = {
    file: sourceRangeForLiteral.file,
    start: {
      column: sourceRangeForLiteral.start.column + 1,
      line: sourceRangeForLiteral.start.line
    },
    end: {
      column: sourceRangeForLiteral.end.column - 1,
      line: sourceRangeForLiteral.end.line
    }
  };
  const parsed = parseExpression(expressionText, sourceRange);
  if (parsed && parsed.type === 'failure') {
    warnings.push(new Warning({parsedDocument: document, ...parsed.warning}));
  } else if (parsed && parsed.type === 'success') {
    result.databinding = new JavascriptDatabindingExpression(
        stringLiteral,
        sourceRange,
        expressionText,
        parsed.program,
        kind,
        document);
    for (const warning of result.databinding.warnings) {
      warnings.push(warning);
    }
  }
  return result;
}
