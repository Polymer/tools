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

import generate from 'babel-generator';
import * as babel from 'babel-types';
import * as doctrine from 'doctrine';

import {MethodParam, ScannedMethod} from '../index';
import {ImmutableSet} from '../model/immutable';
import {Privacy} from '../model/model';
import {ScannedEvent, Severity, SourceRange, Warning} from '../model/model';
import {ParsedDocument} from '../parser/document';
import * as docs from '../polymer/docs';
import {annotateEvent} from '../polymer/docs';

import * as astValue from './ast-value';
import * as estraverse from './estraverse-shim';
import {JavaScriptDocument} from './javascript-document';
import * as jsdoc from './jsdoc';

/**
 * Returns whether a Babel node matches a particular object path.
 *
 * e.g. you have a MemberExpression node, and want to see whether it represents
 * `Foo.Bar.Baz`:
 *    matchesCallExpressio
    (node, ['Foo', 'Bar', 'Baz'])
 *
 * @param {babel.Node} expression The Babel node to match against.
 * @param {Array<string>} path The path to look for.
 */
export function matchesCallExpression(
    expression: babel.MemberExpression, path: string[]): boolean {
  if (!expression.property || !expression.object) {
    return false;
  }
  console.assert(path.length >= 2);

  if (!babel.isIdentifier(expression.property)) {
    return false;
  }
  // Unravel backwards, make sure properties match each step of the way.
  if (expression.property.name !== path[path.length - 1]) {
    return false;
  }
  // We've got ourselves a final member expression.
  if (path.length === 2 && babel.isIdentifier(expression.object)) {
    return expression.object.name === path[0];
  }
  // Nested expressions.
  if (path.length > 2 && babel.isMemberExpression(expression.object)) {
    return matchesCallExpression(
        expression.object, path.slice(0, path.length - 1));
  }

  return false;
}

/**
 * @param {Node} key The node representing an object key or expression.
 * @return {string} The name of that key.
 */
export function objectKeyToString(key: babel.Node): string|undefined {
  if (babel.isIdentifier(key)) {
    return key.name;
  }
  if (babel.isLiteral(key)) {
    return '' + astValue.expressionToValue(key);
  }
  if (babel.isMemberExpression(key)) {
    return objectKeyToString(key.object) + '.' +
        objectKeyToString(key.property);
  }
  return undefined;
}

export const CLOSURE_CONSTRUCTOR_MAP = new Map(
    [['Boolean', 'boolean'], ['Number', 'number'], ['String', 'string']]);

const VALID_EXPRESSION_TYPES = new Map([
  ['ArrayExpression', 'Array'],
  ['BlockStatement', 'Function'],
  ['BooleanLiteral', 'boolean'],
  ['FunctionExpression', 'Function'],
  ['NullLiteral', 'null'],
  ['NumericLiteral', 'number'],
  ['ObjectExpression', 'Object'],
  ['RegExpLiteral', 'RegExp'],
  ['StringLiteral', 'string'],
  ['TemplateLiteral', 'string'],
]);

/**
 * AST expression -> Closure type.
 *
 * Accepts literal values, and native constructors.
 *
 * @param {Node} node A Babel expression node.
 * @return {string} The type of that expression, in Closure terms.
 */
export function closureType(
    node: babel.Node, sourceRange: SourceRange, document: ParsedDocument):
    string|Warning {
  const type = VALID_EXPRESSION_TYPES.get(node.type);
  if (type) {
    return type;
  }
  if (babel.isIdentifier(node)) {
    return CLOSURE_CONSTRUCTOR_MAP.get(node.name) || node.name;
  }
  return new Warning({
    code: 'no-closure-type',
    message: `Unable to determine closure type for expression of type ` +
        `${node.type}`,
    severity: Severity.WARNING,
    sourceRange,
    parsedDocument: document,
  });
}

export function getAttachedComment(node: babel.Node): string|undefined {
  const comments = getLeadingComments(node) || [];
  return comments && comments[comments.length - 1];
}

/**
 * Returns all comments from a tree defined with @event.
 */
export function getEventComments(node: babel.Node): Map<string, ScannedEvent> {
  const eventComments = new Set<string>();
  estraverse.traverse(node, {
    enter(node: babel.Node) {
      (node.leadingComments || [])
          .concat(node.trailingComments || [])
          .map((commentAST) => commentAST.value)
          .filter((comment) => comment.indexOf('@event') !== -1)
          .forEach((comment) => eventComments.add(comment));
    }
  });
  const events = [...eventComments]
                     .map(
                         (comment) => annotateEvent(jsdoc.parseJsdoc(
                             jsdoc.removeLeadingAsterisks(comment).trim())))
                     .filter((ev) => !!ev)
                     .sort((ev1, ev2) => ev1.name.localeCompare(ev2.name));
  return new Map(events.map((e) => [e.name, e] as [string, ScannedEvent]));
}

function getLeadingComments(node: babel.Node): string[]|undefined {
  if (!node) {
    return;
  }
  const comments = [];
  for (const comment of node.leadingComments || []) {
    // Espree says any comment that immediately precedes a node is
    // "leading", but we want to be stricter and require them to be
    // touching. If we don't have locations for some reason, err on the
    // side of including the comment.
    if (!node.loc || !comment.loc ||
        node.loc.start.line - comment.loc.end.line < 2) {
      comments.push(comment.value);
    }
  }
  return comments.length ? comments : undefined;
}

export function getPropertyValue(
    node: babel.ObjectExpression, name: string): babel.Node|undefined {
  const properties = node.properties;
  for (const property of properties) {
    if (!babel.isSpreadProperty(property) &&
        objectKeyToString(property.key) === name) {
      return property.value;
    }
  }
}

/**
 * Create a ScannedMethod object from an estree Property AST node.
 */
export function toScannedMethod(
    node: babel.ObjectProperty|babel.ObjectMethod|babel.ClassMethod,
    sourceRange: SourceRange,
    document: ParsedDocument): ScannedMethod {
  const parsedJsdoc = jsdoc.parseJsdoc(getAttachedComment(node) || '');
  const description = parsedJsdoc.description.trim();
  const maybeName = objectKeyToString(node.key);

  const warnings: Warning[] = [];
  if (!maybeName) {
    warnings.push(new Warning({
      code: 'unknown-method-name',
      message: `Could not determine name of method from expression of type: ` +
          `${node.key.type}`,
      sourceRange: sourceRange,
      severity: Severity.INFO,
      parsedDocument: document
    }));
  }

  const value = babel.isObjectProperty(node) ? node.value : node;

  let type = closureType(value, sourceRange, document);
  const typeTag = jsdoc.getTag(parsedJsdoc, 'type');
  if (typeTag) {
    type = doctrine.type.stringify(typeTag.type!) || type;
  }
  if (type instanceof Warning) {
    warnings.push(type);
    type = 'Function';
  }
  const name = maybeName || '';
  const scannedMethod: ScannedMethod = {
    name,
    type,
    description,
    sourceRange,
    warnings,
    astNode: node,
    jsdoc: parsedJsdoc,
    privacy: getOrInferPrivacy(name, parsedJsdoc)
  };

  if (value && babel.isFunction(value)) {
    const paramTags = new Map<string, doctrine.Tag>();
    if (scannedMethod.jsdoc) {
      for (const tag of (scannedMethod.jsdoc.tags || [])) {
        if (tag.title === 'param' && tag.name) {
          paramTags.set(tag.name, tag);

        } else if (tag.title === 'return' || tag.title === 'returns') {
          scannedMethod.return = {};
          if (tag.type) {
            scannedMethod.return.type = doctrine.type.stringify(tag.type!);
          }
          if (tag.description) {
            scannedMethod.return.desc = tag.description;
          }
        }
      }
    }

    scannedMethod.params = (value.params || []).map((nodeParam) => {
      let name;
      let defaultValue;
      let rest;

      if (babel.isIdentifier(nodeParam)) {
        // Basic parameter: method(param)
        name = nodeParam.name;

      } else if (
          babel.isRestElement(nodeParam) &&
          babel.isIdentifier(nodeParam.argument)) {
        // Rest parameter: method(...param)
        name = nodeParam.argument.name;
        rest = true;

      } else if (
          babel.isAssignmentPattern(nodeParam) &&
          babel.isIdentifier(nodeParam.left) &&
          babel.isLiteral(nodeParam.right)) {
        // Parameter with a default: method(param = "default")
        name = nodeParam.left.name;
        defaultValue = generate(nodeParam.right).code;

      } else {
        // Some AST pattern we don't recognize. Hope the code generator does
        // something reasonable.
        name = generate(nodeParam).code;
      }

      let type;
      let description;
      const tag = paramTags.get(name);
      if (tag) {
        if (tag.type) {
          type = doctrine.type.stringify(tag.type);
        }
        if (tag.description) {
          description = tag.description;
        }
      }

      const param: MethodParam = {name, type, defaultValue, rest, description};
      return param;
    });
  }

  return scannedMethod;
}


export function getOrInferPrivacy(
    name: string,
    annotation: jsdoc.Annotation|undefined,
    defaultPrivacy: Privacy = 'public'): Privacy {
  const explicitPrivacy = jsdoc.getPrivacy(annotation);
  const specificName = name.slice(name.lastIndexOf('.') + 1);

  if (explicitPrivacy) {
    return explicitPrivacy;
  }
  if (specificName.startsWith('__')) {
    return 'private';
  } else if (specificName.startsWith('_')) {
    return 'protected';
  } else if (specificName.endsWith('_')) {
    return 'private';
  } else if (configurationProperties.has(specificName)) {
    return 'protected';
  }
  return defaultPrivacy;
}

/**
 * Properties on element prototypes that are part of the custom elment
 * lifecycle or Polymer configuration syntax.
 *
 * TODO(rictic): only treat the Polymer ones as private when dealing with
 *   Polymer.
 */
export const configurationProperties: ImmutableSet<string> = new Set([
  'attached',
  'attributeChanged',
  'beforeRegister',
  'configure',
  'constructor',
  'created',
  'detached',
  'enableCustomStyleProperties',
  'extends',
  'hostAttributes',
  'is',
  'listeners',
  'mixins',
  'observers',
  'properties',
  'ready',
  'registered',
]);

/**
 * Scan any methods on the given node, if it's a class expression/declaration.
 */
export function getMethods(node: babel.Node, document: JavaScriptDocument):
    Map<string, ScannedMethod> {
  const methods = new Map<string, ScannedMethod>();
  for (const statement of _getMethods(node)) {
    if (statement.static === false) {
      const method = toScannedMethod(
          statement, document.sourceRangeForNode(statement)!, document);
      docs.annotate(method);
      methods.set(method.name, method);
    }
  }
  return methods;
}

/**
 * Scan any static methods on the given node, if it's a class
 * expression/declaration.
 */
export function getStaticMethods(
    node: babel.Node,
    document: JavaScriptDocument): Map<string, ScannedMethod> {
  const methods = new Map<string, ScannedMethod>();
  for (const method of _getMethods(node)) {
    if (method.static === true) {
      const scannedMethod = toScannedMethod(
          method, document.sourceRangeForNode(method)!, document);
      docs.annotate(scannedMethod);
      methods.set(scannedMethod.name, scannedMethod);
    }
  }
  return methods;
}

function* _getMethods(node: babel.Node) {
  if (!babel.isClassDeclaration(node) && !babel.isClassExpression(node)) {
    return;
  }
  for (const statement of node.body.body) {
    if (babel.isClassMethod(statement) && statement.kind === 'method') {
      yield statement;
    }
  }
}
