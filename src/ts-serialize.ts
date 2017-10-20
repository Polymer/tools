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

import * as util from 'util';

import * as ts from './ts-ast';

/**
 * Serialize a TypeScript declarations file AST to a string.
 */
export function serializeTsDeclarations(
    node: ts.Document|ts.Namespace|ts.Class|ts.Interface|ts.Function|
    ts.Property,
    depth: number = 0): string {
  switch (node.kind) {
    case 'document':
      return serializeDocument(node);
    case 'namespace':
      return serializeNamespace(node, depth);
    case 'class':
      return serializeClass(node, depth);
    case 'interface':
      return serializeInterface(node, depth);
    case 'function':
      return serializeFunctionOrMethod(node, depth);
    case 'property':
      return serializeProperty(node, depth);
    default:
      const never: never = node;
      throw new Error(`Unknown declarations AST kind: ${util.inspect(never)}`);
  }
}

/**
 * Serialize a TypeScript type expression AST to a string.
 */
export function serializeType(
    node: ts.Type, maybeParenthesize = false): string {
  switch (node.kind) {
    case 'name':
      return node.name;

    case 'array':
      return `Array<${serializeType(node.itemType)}>`;

    case 'union':
      return node.members.map((member) => serializeType(member, true))
          .join('|');

    case 'function':
      const params = node.params.map(
          (param) => `${param.name}: ${serializeType(param.type)}`);
      const func = `(${params.join(', ')}) => ${serializeType(node.returns)}`;
      // The function syntax is ambiguous when part of a union, so add parens
      // (e.g. `() => string|null` vs `(() => string)|null`).
      return maybeParenthesize ? `(${func})` : func;

    default:
      const never: never = node;
      throw new Error(`Unknown type AST kind: ${util.inspect(never)}`);
  }
}

function serializeDocument(node: ts.Document): string {
  return node.members.map((m) => serializeTsDeclarations(m)).join('\n');
}

function serializeNamespace(node: ts.Namespace, depth: number): string {
  let out = ''
  const i = indent(depth)
  out += i
  if (depth === 0) {
    out += 'declare ';
  }
  out += `namespace ${node.name} {\n`;
  for (const member of node.members) {
    out += '\n' + serializeTsDeclarations(member, depth + 1);
  }
  out += `${i}}\n`;
  return out;
}

function serializeClass(node: ts.Class|ts.Interface, depth: number): string {
  let out = '';
  const i = indent(depth);
  if (node.description) {
    out += formatComment(node.description, depth);
  }
  out += i;
  if (depth === 0) {
    out += 'declare ';
  }
  out += `class ${node.name}`;
  if (node.extends) {
    out += ' extends ' + node.extends;
  }
  out += ' {\n';
  for (const property of node.properties) {
    out += serializeProperty(property, depth + 1);
  }
  for (const method of node.methods) {
    out += serializeFunctionOrMethod(method, depth + 1);
  }
  if (!out.endsWith('\n')) {
    out += '\n';
  }
  out += `${i}}\n`;
  return out;
}

function serializeInterface(node: ts.Interface, depth: number): string {
  let out = '';
  const i = indent(depth);
  if (node.description) {
    out += formatComment(node.description, depth);
  }
  out += i;
  out += `interface ${node.name}`;
  if (node.extends.length) {
    out += ' extends ' + node.extends.join(', ');
  }
  out += ' {\n';
  for (const property of node.properties) {
    out += serializeProperty(property, depth + 1);
  }
  for (const method of node.methods) {
    out += serializeFunctionOrMethod(method, depth + 1);
  }
  if (!out.endsWith('\n')) {
    out += '\n';
  }
  out += `${i}}\n`;
  return out;
}

function serializeFunctionOrMethod(
    node: ts.Function|ts.Method, depth: number): string {
  let out = ''
  const i = indent(depth);
  if (node.description) {
    out += '\n' + formatComment(node.description, depth);
  }
  if (depth === 0) {
    out += 'declare ';
  }
  out += i;
  if (node.kind === 'function') {
    out += 'function ';
  }
  out += `${node.name}(`;
  out += node.params.map(serializeParam).join(', ');
  out += `): ${serializeType(node.returns)};\n`;
  return out;
}

function serializeParam(param: ts.Param): string {
  return `${param.name}${param.optional ? '?' : ''}: ${
      serializeType(param.type)}`;
}

function serializeProperty(node: ts.Property, depth: number): string {
  let out = '';
  const i = indent(depth);
  if (node.description) {
    out += '\n' + formatComment(node.description, depth);
  }
  out += `${i}${quotePropertyName(node.name)}: ${serializeType(node.type)};\n`;
  return out;
}

function quotePropertyName(name: string): string {
  // TODO We should escape reserved words, and there are many more safe
  // characters than are included in this RegExp.
  // See https://mathiasbynens.be/notes/javascript-identifiers-es6
  const safe = name.match(/^[_$a-zA-Z][_$a-zA-Z0-9]*$/);
  return safe ? name : JSON.stringify(name);
}

const indentSpaces = 2;

function indent(depth: number): string {
  return ' '.repeat(depth * indentSpaces);
}

function formatComment(comment: string, depth: number): string {
  const i = indent(depth);
  return `${i}/**\n` + comment.replace(/^/gm, `${i} * `) + `\n${i} */\n`;
}
