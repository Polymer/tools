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

// Useful resources for working on this package:
// https://eslint.org/doctrine/demo/
// https://github.com/google/closure-compiler/wiki/Types-in-the-Closure-Type-System

import * as doctrine from 'doctrine';

import * as ts from './ts-ast';

const {parseType, parseParamType} = require('doctrine/lib/typed.js');

/**
 * Convert a Closure type expression string to its equivalent TypeScript AST
 * node.
 *
 * Note that function and method parameters should instead use
 * `closureParamToTypeScript`.
 */
export function closureTypeToTypeScript(
    closureType: string|null|undefined, templateTypes: string[] = []): ts.Type {
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
 * Convert a Closure function or method parameter type expression string to its
 * equivalent TypeScript AST node.
 *
 * This differs from `closureTypeToTypeScript` in that it always returns a
 * `ParamType`, and can parse the optional (`foo=`) and rest (`...foo`)
 * syntaxes, which only apply when parsing an expression in the context of a
 * parameter.
 */
export function closureParamToTypeScript(
    name: string,
    closureType: string|null|undefined,
    templateTypes: string[] = [],
    ): ts.ParamType {
  if (!closureType) {
    return new ts.ParamType({
      name,
      type: ts.anyType,
      optional: false,
      rest: false,
    });
  }

  let ast;
  try {
    ast = parseParamType(closureType);
  } catch {
    return new ts.ParamType({
      name,
      type: ts.anyType,
      // It's important we try to get optional right even if we can't parse
      // the annotation, because non-optional arguments can't follow optional
      // ones.
      optional: closureType.endsWith('='),
      rest: false,
    });
  }

  return convertParam(name, ast, templateTypes);
}

/**
 * Convert a doctrine function or method parameter AST node to its equivalent
 * TypeScript parameter AST node.
 */
function convertParam(
    name: string, node: doctrine.Type, templateTypes: string[]): ts.ParamType {
  switch (node.type) {
    case 'OptionalType':
      return new ts.ParamType({
        name,
        type: convert(node.expression, templateTypes),
        optional: true,
        rest: false,
      });

    case 'RestType':
      return new ts.ParamType({
        name,
        // The Closure type annotation for a rest parameter looks like
        // `...foo`, where `foo` is implicitly an array. The TypeScript
        // equivalent is explicitly an array, so we wrap it in one here.
        type: new ts.ArrayType(
            node.expression !== undefined ?
                convert(node.expression, templateTypes) :
                ts.anyType),
        optional: false,
        rest: true,
      });

    default:
      return new ts.ParamType({
        name,
        type: convert(node, templateTypes),
        optional: false,
        rest: false,
      });
  }
}

/**
 * Convert a doctrine AST node to its equivalent TypeScript AST node.
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
  } else if (isParameterizedObject(node)) {  // Object<foo, bar>
    t = convertIndexableObject(node, templateTypes);
  } else if (isBarePromise(node)) {  // Promise
    // In Closure, `Promise` is ok, but in TypeScript this is invalid and must
    // be explicitly parameterized as `Promise<any>`.
    t = new ts.ParameterizedType('Promise', [ts.anyType]);
  } else if (isParameterizedType(node)) {  // foo<T>
    t = convertParameterizedType(node, templateTypes);
  } else if (isUnion(node)) {  // foo|bar
    t = convertUnion(node, templateTypes);
  } else if (isFunction(node)) {  // function(foo): bar
    t = convertFunction(node, templateTypes);
  } else if (isBareArray(node)) {  // Array
    t = new ts.ArrayType(ts.anyType);
  } else if (isRecordType(node)) {  // {foo:bar}
    t = convertRecord(node, templateTypes);
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
    t = new ts.NameType(renameMap.get(node.name) || node.name);
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
 * Special cases where a named type in Closure maps to something different in
 * TypeScript.
 */
const renameMap = new Map<string, string>([
  // Closure's `Object` type excludes primitives, so it is closest to
  // TypeScript's `object`. (Technically this should be `object|Symbol`, but we
  // will concede that technicality.)
  ['Object', 'object'],
  // The tagged template literal function argument.
  ['ITemplateArray', 'TemplateStringsArray'],
]);

/*
 * As above but only applicable when parameterized (`Foo<T>`)
 */
const parameterizedRenameMap = new Map<string, string>([
  ['HTMLCollection', 'HTMLCollectionOf'],
  ['NodeList', 'NodeListOf'],
]);

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
        return false;
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

function convertIndexableObject(
    node: doctrine.type.TypeApplication,
    templateTypes: string[]): ts.IndexableObjectType|ts.NameType {
  if (node.applications.length !== 2) {
    console.error('Parameterized Object must have two parameters.');
    return ts.anyType;
  }
  return new ts.IndexableObjectType(
      convert(node.applications[0], templateTypes),
      convert(node.applications[1], templateTypes));
}

function convertParameterizedType(
    node: doctrine.type.TypeApplication,
    templateTypes: string[]): ts.ParameterizedType|ts.NameType {
  if (!isName(node.expression)) {
    console.error('Could not find name of parameterized type');
    return ts.anyType;
  }
  const types = node.applications.map(
      (application) => convert(application, templateTypes));
  const name = renameMap.get(node.expression.name) ||
      parameterizedRenameMap.get(node.expression.name) || node.expression.name;
  return new ts.ParameterizedType(name, types);
}

function convertUnion(
    node: doctrine.type.UnionType, templateTypes: string[]): ts.Type {
  return new ts.UnionType(
      node.elements.map((element) => convert(element, templateTypes)));
}

function convertFunction(
    node: doctrine.type.FunctionType,
    templateTypes: string[]): ts.FunctionType|ts.ConstructorType {
  const params = node.params.map(
      (param, idx) => convertParam(
          // TypeScript wants named parameters, but we don't have names.
          'p' + idx,
          param,
          templateTypes));
  if (node.new) {
    return new ts.ConstructorType(
        params,
        // It doesn't make sense for a constructor to return something other
        // than a named type. Also, in this context the name type is not
        // nullable by default, so it's simpler to just directly convert here.
        isName(node.this) ? new ts.NameType(node.this.name) : ts.anyType);
  } else {
    return new ts.FunctionType(
        params,
        // Cast because type is wrong: `FunctionType.result` is not an array.
        node.result ?
            convert(node.result as {} as doctrine.Type, templateTypes) :
            ts.anyType);
  }
}

function convertRecord(node: doctrine.type.RecordType, templateTypes: string[]):
    ts.RecordType|ts.NameType {
  const fields = [];
  for (const field of node.fields) {
    if (field.type !== 'FieldType') {
      return ts.anyType;
    }
    const fieldType =
        field.value ? convert(field.value, templateTypes) : ts.anyType;

    // In Closure you can't declare a record field optional, instead you
    // declare `foo: bar|undefined`. In TypeScript we can represent this as
    // `foo?: bar`. This also matches the semantics better, since Closure would
    // allow the field to be omitted when it is `|undefined`, but TypeScript
    // would require it to be explicitly set to `undefined`.
    let optional = false;
    if (fieldType.kind === 'union') {
      fieldType.members = fieldType.members.filter((member) => {
        if (member.kind === 'name' && member.name === 'undefined') {
          optional = true;
          return false;
        }
        return true;
      });

      // No need for a union if we collapsed it to one member.
      fieldType.simplify();
    }

    fields.push(new ts.ParamType({name: field.key, type: fieldType, optional}));
  }
  return new ts.RecordType(fields);
}

function isParameterizedArray(node: doctrine.Type):
    node is doctrine.type.TypeApplication {
  return node.type === 'TypeApplication' &&
      node.expression.type === 'NameExpression' &&
      node.expression.name === 'Array';
}

function isParameterizedType(node: doctrine.Type):
    node is doctrine.type.TypeApplication {
  return node.type === 'TypeApplication';
}

function isBareArray(node: doctrine.Type):
    node is doctrine.type.NameExpression {
  return node.type === 'NameExpression' && node.name === 'Array';
}

function isBarePromise(node: doctrine.Type):
    node is doctrine.type.NameExpression {
  return node.type === 'NameExpression' && node.name === 'Promise';
}

/**
 * Matches `Object<foo, bar>` but not `Object` (which is a NameExpression).
 */
function isParameterizedObject(node: doctrine.Type):
    node is doctrine.type.TypeApplication {
  return node.type === 'TypeApplication' &&
      node.expression.type === 'NameExpression' &&
      node.expression.name === 'Object';
}

function isUnion(node: doctrine.Type): node is doctrine.type.UnionType {
  return node.type === 'UnionType';
}

function isFunction(node: doctrine.Type): node is doctrine.type.FunctionType {
  return node.type === 'FunctionType';
}

function isRecordType(node: doctrine.Type): node is doctrine.type.RecordType {
  return node.type === 'RecordType';
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
