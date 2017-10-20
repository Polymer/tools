/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

// TODO Object<foo>, Object<foo, bar>
// TODO Record types
// TODO Function variadic parameters
//
// Useful resources for working on this package:
// https://eslint.org/doctrine/demo/
// https://github.com/google/closure-compiler/wiki/Types-in-the-Closure-Type-System

import * as doctrine from 'doctrine';
const {parseType, parseParamType} = require('doctrine/lib/typed.js');

/**
 * Convert from a type annotation in Closure syntax to TypeScript syntax (e.g
 * `Array` => `Array<any>|null`).
 */
export function closureTypeToTypeScript(closureType: string): string {
  let ast;
  try {
    ast = parseType(closureType);
  } catch {
    return 'any';
  }
  return serialize(ast);
}

/**
 * Convert from a parameter type annotation in Closure syntax to TypeScript
 * syntax (e.g `Array=` => `{type: 'Array<any>|null', optional: true}`).
 */
export function closureParamToTypeScript(closureType: string):
    {optional: boolean, type: string} {
  let ast;
  try {
    ast = parseParamType(closureType);
  } catch {
    return {
      type: 'any',
      // It's important we try to get optional right even if we can't parse
      // the annotation, because non-optional arguments can't follow optional
      // ones.
      optional: closureType.endsWith('='),
    };
  }
  const optional = ast.type === 'OptionalType';
  return {
    optional,
    type: serialize(optional ? ast.expression : ast),
  };
}

/**
 * Format the given Closure type expression AST node as a TypeScript type
 * annotation string.
 */
function serialize(node: doctrine.Type, greedy = false): string {
  let t = '';

  let nullable = null;
  if (isNullable(node)) {  // ?foo
    nullable = true;
    node = node.expression;
  } else if (isNonNullable(node)) {  // !foo
    nullable = false;
    node = node.expression;
  } else {
    nullable = nullableByDefault(node);
  }

  if (isParameterizedArray(node)) {  // Array<foo>
    t = serializeArray(node);
  } else if (isUnion(node)) {  // foo|bar
    t = serializeUnion(node);
  } else if (isFunction(node)) {  // function(foo): bar
    t = serializeFunction(node);
  } else if (isBareArray(node)) {  // Array
    t = 'Array<any>';
  } else if (isAllLiteral(node)) {  // *
    t = 'any';
  } else if (isNullableLiteral(node)) {  // ?
    t = 'any';
  } else if (isNullLiteral(node)) {  // null
    t = 'null';
  } else if (isUndefinedLiteral(node)) {  // undefined
    t = 'undefined';
  } else if (isName(node)) {  // string, Object, MyClass, etc.
    t = node.name;
  } else {
    console.error('Unknown syntax.');
    return '';
  }

  if (nullable) {
    greedy = true;
  }
  if (greedy && ambiguousPrecendence(node)) {
    t = `(${t})`;
  }
  if (nullable) {
    t = `${t}|null`;
  }

  return t;
}

/**
 * Return whether the given AST node is an expression that is nullable by
 * default in the Closure type system.
 */
function nullableByDefault(node: doctrine.Type): boolean {
  if (isName(node)) {
    switch (node.name) {
      case 'string':
      case 'number':
      case 'boolean':
        return false
    }
    return true;
  }
  return isParameterizedArray(node);
}

/**
 * Return whether the given node should be wrapped in parenthesis when it is an
 * argument to a greedy operator. For example, if we are serializing a union,
 * and one of the arguments is itself a union, then that argument should be
 * wrapped in parenthesis to avoid precendence problems.
 */
function ambiguousPrecendence(node: doctrine.Type): boolean {
  if (isFunction(node)) {
    return true;
  }
  if (isUnion(node)) {
    if (node.elements.length === 1) {
      // Unions of length 1 get collapsed, so recurse in case we hit a
      // descendent that is ambiguous.
      return ambiguousPrecendence(node.elements[0]);
    }
    return true;
  }
  return false;
}

function serializeArray(node: doctrine.type.TypeApplication): string {
  if (node.applications.length !== 1) {
    console.error('Invalid array expression.');
    return '';
  }
  const arg = node.applications[0];
  return `Array<${serialize(arg)}>`;
}

function serializeUnion(node: doctrine.type.UnionType): string {
  if (node.elements.length === 1) {
    // `(string)` will be represented as a union of length one. Just flatten.
    return serialize(node.elements[0]);
  }
  return node.elements.map(e => serialize(e, true)).join('|');
}

function serializeFunction(node: doctrine.type.FunctionType): string {
  let out = '(';
  for (let i = 0; i < node.params.length; i++) {
    if (i > 0) {
      out += ', ';
    }
    out += `p${i}: ${serialize(node.params[i])}`;
  }
  // Casting because typings are wrong: `FunctionType.result` is not an array.
  const result = node.result as any;
  out += ') => ' + (result && serialize(result) || 'any');
  return out;
}

function isParameterizedArray(node: doctrine.Type):
    node is doctrine.type.TypeApplication {
  return node.type === 'TypeApplication' &&
      node.expression.type === 'NameExpression' &&
      node.expression.name === 'Array';
}

function isBareArray(node: doctrine.Type):
    node is doctrine.type.TypeApplication {
  return node.type === 'NameExpression' && node.name === 'Array';
}

function isUnion(node: doctrine.Type): node is doctrine.type.UnionType {
  return node.type === 'UnionType';
}

function isFunction(node: doctrine.Type): node is doctrine.type.FunctionType {
  return node.type === 'FunctionType';
}

function isNullable(node: doctrine.Type): node is doctrine.type.NullableType {
  return node.type === 'NullableType';
}

function isNonNullable(node: doctrine.Type):
    node is doctrine.type.NonNullableType {
  return node.type === 'NonNullableType';
}

function isAllLiteral(node: doctrine.Type): node is doctrine.type.AllLiteral {
  return node.type === 'AllLiteral';
}

function isNullLiteral(node: doctrine.Type): node is doctrine.type.NullLiteral {
  return node.type === 'NullLiteral';
}

function isNullableLiteral(node: doctrine.Type):
    node is doctrine.type.NullableLiteral {
  return node.type === 'NullableLiteral';
}

function isUndefinedLiteral(node: doctrine.Type):
    node is doctrine.type.UndefinedLiteral {
  return node.type === 'UndefinedLiteral';
}

function isName(node: doctrine.Type): node is doctrine.type.NameExpression {
  return node.type === 'NameExpression';
}
