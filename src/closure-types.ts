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
// TODO Optional param =
// TODO Function variadic parameters
//
// Useful resources for working on this package:
// https://eslint.org/doctrine/demo/
// https://github.com/google/closure-compiler/wiki/Types-in-the-Closure-Type-System

import * as doctrine from 'doctrine';
const {parseType} = require('doctrine/lib/typed.js');

/**
 * Convert from a type annotation in Closure syntax to TypeScript syntax (e.g
 * `Array<string>` => `string[]|null`).
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
 * Format the given Closure type expression AST node as a TypeScript type
 * annotation string.
 */
function serialize(node: doctrine.Type): string {
  let t = '';

  let nullable = null;

  if (isNullable(node)) {  // ?foo
    nullable = true;
    node = node.expression;
  } else if (isNonNullable(node)) {  // !foo
    nullable = false;
    node = node.expression;
  }

  if (isArray(node)) {  // Array<foo>
    t = serializeArray(node);
  } else if (isUnion(node)) {  // foo|bar
    t = serializeUnion(node);
  } else if (isFunction(node)) {  // function(foo): bar
    t = serializeFunction(node);
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

  if (nullable === true || (nullable === null && nullableByDefault(node))) {
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
  return isArray(node);
}

function serializeArray(node: doctrine.type.TypeApplication): string {
  if (node.applications.length !== 1) {
    console.error('Invalid array expression.');
    return '';
  }
  return serialize(node.applications[0]) + '[]';
}

function serializeUnion(node: doctrine.type.UnionType): string {
  if (node.elements.length === 1) {
    // `(string)` will be represented as a union of length one. Just flatten.
    return serialize(node.elements[0]);
  }
  return '(' + node.elements.map(e => serialize(e)).join('|') + ')';
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

function isArray(node: doctrine.Type): node is doctrine.type.TypeApplication {
  return node.type === 'TypeApplication' &&
      node.expression.type === 'NameExpression' &&
      node.expression.name === 'Array';
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
