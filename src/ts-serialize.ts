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

import {Class, Document, Function, Interface, Method, Namespace, Property} from './ts-ast';

/**
 * Encode a TypeScript AST node in TypeScript declaration file syntax (d.ts).
 */
export function serializeTsDeclarations(
    node: Document|Namespace|Class|Interface|Function|Property,
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
      throw new Error(`Unknown node kind: ${util.inspect(never)}`);
  }
}

function serializeDocument(node: Document): string {
  return node.members.map((m) => serializeTsDeclarations(m)).join('\n');
}

function serializeNamespace(node: Namespace, depth: number): string {
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

function serializeClass(node: Class|Interface, depth: number): string {
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

function serializeInterface(node: Interface, depth: number): string {
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
    node: Function|Method, depth: number): string {
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
  out += node.params.map(({name, type}) => `${name}: ${type}`).join(', ');
  out += `): ${node.returns};\n`;
  return out;
}

function serializeProperty(node: Property, depth: number): string {
  let out = '';
  const i = indent(depth);
  if (node.description) {
    out += '\n' + formatComment(node.description, depth);
  }
  out += `${i}${quotePropertyName(node.name)}: ${node.type};\n`;
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
