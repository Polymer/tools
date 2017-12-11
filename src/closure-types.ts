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
//
// Useful resources for working on this package:
// https://eslint.org/doctrine/demo/
// https://github.com/google/closure-compiler/wiki/Types-in-the-Closure-Type-System

import * as doctrine from 'doctrine';

import * as ts from './ts-ast';

const {parseType, parseParamType} = require('doctrine/lib/typed.js');

/**
 * Convert from a type annotation in Closure syntax to a TypeScript type
 * expression AST (e.g `Array` => `Array<any>|null`).
 */
export function closureTypeToTypeScript(
    closureType: (string|null|undefined),
    templateTypes: string[] = []): ts.Type {
  if (!closureType) {
    return ts.anyType;
  }
  let ast;
  try {
    ast = parseType(closureType);
  } catch {
    return ts.anyType;
  }
  return convert(ast, templateTypes);
}

/**
 * Convert from a parameter type annotation in Closure syntax to a TypeScript
 * type expression AST
 * (e.g `Array=` => `{type: 'Array<any>|null', optional: true}`).
 */
export function closureParamToTypeScript(
    closureType: (string|null|undefined),
    templateTypes: string[] = [],
    ): {type: ts.Type, optional: boolean, rest: boolean} {
  if (!closureType) {
    return {type: ts.anyType, optional: false, rest: false};
  }

  let ast;
  try {
    ast = parseParamType(closureType);
  } catch {
    return {
      type: ts.anyType,
      // It's important we try to get optional right even if we can't parse
      // the annotation, because non-optional arguments can't follow optional
      // ones.
      optional: closureType.endsWith('='),
      rest: false,
    };
  }

  // Optional and Rest types are always the top-level node.
  switch (ast.type) {
    case 'OptionalType':
      return {
        type: convert(ast.expression, templateTypes),
        optional: true,
        rest: false,
      };
    case 'RestType':
      return {
        // The Closure type annotation for a rest parameter looks like
        // `...foo`, where `foo` is implicitly an array. The TypeScript
        // equivalent is explicitly an array, so we wrap it in one here.
        type: new ts.ArrayType(convert(ast.expression, templateTypes)),
        optional: false,
        rest: true,
      };
    default:
      return {
        type: convert(ast, templateTypes),
        optional: false,
        rest: false,
      };
  }
}

/**
 * Format the given Closure type expression AST node as a TypeScript type
 * annotation string.
 */
function convert(node: doctrine.Type, templateTypes: string[]): ts.Type {
  let nullable;
  if (isNullable(node)) {  // ?foo
    nullable = true;
    node = node.expression;
  } else if (isNonNullable(node)) {  // !foo
    nullable = false;
    node = node.expression;
  } else if (isName(node) && templateTypes.includes(node.name)) {
    // A template type "T" looks naively like a regular name type to doctrine
    // (e.g. a class called "T"), which would be nullable by default. However,
    // template types are not nullable by default.
    nullable = false;
  } else {
    nullable = nullableByDefault(node);
  }

  let t: ts.Type;

  if (isParameterizedArray(node)) {  // Array<foo>
    t = convertArray(node, templateTypes);
  } else if (isUnion(node)) {  // foo|bar
    t = convertUnion(node, templateTypes);
  } else if (isFunction(node)) {  // function(foo): bar
    t = convertFunction(node, templateTypes);
  } else if (isBareArray(node)) {  // Array
    t = new ts.ArrayType(ts.anyType);
  } else if (isAllLiteral(node)) {  // *
    t = ts.anyType;
  } else if (isNullableLiteral(node)) {  // ?
    t = ts.anyType;
  } else if (isNullLiteral(node)) {  // null
    t = ts.nullType;
  } else if (isUndefinedLiteral(node)) {  // undefined
    t = ts.undefinedType;
  } else if (isVoidLiteral(node)) {  // void
    t = new ts.NameType('void');
  } else if (isName(node)) {  // string, Object, MyClass, etc.
    t = new ts.NameType(node.name);
  } else {
    console.error('Unknown syntax.');
    return ts.anyType;
  }

  if (nullable) {
    t = new ts.UnionType([t, ts.nullType]);
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
      case 'void':
        return false
    }
    return true;
  }
  return isParameterizedArray(node);
}

function convertArray(
    node: doctrine.type.TypeApplication, templateTypes: string[]): ts.Type {
  const applications = node.applications;
  return new ts.ArrayType(
      applications.length === 1 ? convert(applications[0], templateTypes) :
                                  ts.anyType);
}

function convertUnion(
    node: doctrine.type.UnionType, templateTypes: string[]): ts.Type {
  return new ts.UnionType(
      node.elements.map((element) => convert(element, templateTypes)));
}

function convertFunction(
    node: doctrine.type.FunctionType,
    templateTypes: string[]): ts.FunctionType {
  return new ts.FunctionType(
      node.params.map(
          (param, idx) => new ts.ParamType(
              // TypeScript wants named parameters, but we don't have names.
              'p' + idx,
              convert(param, templateTypes))),
      // Cast because typings are wrong: `FunctionType.result` is not an array.
      node.result ? convert(node.result as any, templateTypes) : ts.anyType);
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

function isVoidLiteral(node: doctrine.Type): node is doctrine.type.VoidLiteral {
  return node.type === 'VoidLiteral';
}

function isName(node: doctrine.Type): node is doctrine.type.NameExpression {
  return node.type === 'NameExpression';
}
