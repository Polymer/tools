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

// TODO Document classes better.
// TODO Try to make serialization methods easier to read.

export type Node = Document|Namespace|Class|Interface|Mixin|Function|Method|
    Type|ParamType|Property;

export class Document {
  readonly kind = 'document';
  path: string;
  members: Array<Namespace|Class|Interface|Mixin|Function>;
  referencePaths: Set<string>;

  constructor(data: {
    path: string,
    members?: Array<Namespace|Class|Interface|Mixin|Function>
    referencePaths?: Iterable<string>,
  }) {
    this.path = data.path;
    this.members = data.members || [];
    this.referencePaths = new Set(Array.from(data.referencePaths || []));
  }

  /**
   * Iterate over all nodes in the document, depth first. Includes all
   * recursive ancestors, and the document itself.
   */
  * traverse(): Iterable<Node> {
    for (const m of this.members) {
      yield* m.traverse();
    }
    yield this;
  }

  /**
   * Clean up this AST.
   */
  simplify() {
    for (const node of this.traverse()) {
      if (node.kind === 'union') {
        node.simplify();
      }
    }
  }

  serialize(): string {
    let out = '';
    if (this.referencePaths.size > 0) {
      for (const ref of this.referencePaths) {
        out += `/// <reference path="${ref}" />\n`;
      }
      out += '\n';
    }
    out += this.members.map((m) => m.serialize()).join('\n');
    return out;
  }
}

export class Namespace {
  readonly kind = 'namespace';
  name: string;
  members: Array<Namespace|Class|Interface|Mixin|Function>;

  constructor(data: {
    name: string,
    members?: Array<Namespace|Class|Interface|Mixin|Function>,
  }) {
    this.name = data.name;
    this.members = data.members || [];
  }

  * traverse(): Iterable<Node> {
    for (const m of this.members) {
      yield* m.traverse();
    }
    yield this;
  }

  serialize(depth: number = 0): string {
    let out = ''
    const i = indent(depth)
    out += i
    if (depth === 0) {
      out += 'declare ';
    }
    out += `namespace ${this.name} {\n`;
    for (const member of this.members) {
      out += '\n' + member.serialize(depth + 1);
    }
    out += `${i}}\n`;
    return out;
  }
}

export class Class {
  readonly kind = 'class';
  name: string;
  description: string;
  extends: string;
  mixins: string[];
  properties: Property[];
  methods: Method[];

  constructor(data: {
    name: string,
    description?: string,
    extends?: string,
    mixins?: string[],
    properties?: Property[],
    methods?: Method[]
  }) {
    this.name = data.name;
    this.description = data.description || '';
    this.extends = data.extends || '';
    this.mixins = data.mixins || [];
    this.properties = data.properties || [];
    this.methods = data.methods || [];
  }

  * traverse(): Iterable<Node> {
    for (const p of this.properties) {
      yield* p.traverse();
    }
    for (const m of this.methods) {
      yield* m.traverse();
    }
    yield this;
  }

  serialize(depth: number = 0): string {
    let out = '';
    const i = indent(depth);
    if (this.description) {
      out += formatComment(this.description, depth);
    }
    out += i;
    if (depth === 0) {
      out += 'declare ';
    }
    out += `class ${this.name}`;

    if (this.mixins.length) {
      const i2 = indent(depth + 1);
      out += ' extends';
      for (const mixin of this.mixins) {
        out += `\n${i2}${mixin}(`;
      }
      out += `\n${i2}${this.extends || 'Object'}`;
      out += ')'.repeat(this.mixins.length)

    } else if (this.extends) {
      out += ' extends ' + this.extends;
    }

    out += ' {\n';
    for (const property of this.properties) {
      out += property.serialize(depth + 1);
    }
    for (const method of this.methods) {
      out += method.serialize(depth + 1);
    }
    if (!out.endsWith('\n')) {
      out += '\n';
    }
    out += `${i}}\n`;
    return out;
  }
}

export class Interface {
  readonly kind = 'interface';
  name: string;
  description: string;
  extends: string[];
  properties: Property[];
  methods: Method[];

  constructor(data: {
    name: string,
    description?: string,
    extends?: string[],
    properties?: Property[],
    methods?: Method[]
  }) {
    this.name = data.name;
    this.description = data.description || '';
    this.extends = data.extends || [];
    this.properties = data.properties || [];
    this.methods = data.methods || [];
  }

  * traverse(): Iterable<Node> {
    for (const p of this.properties) {
      yield* p.traverse();
    }
    for (const m of this.methods) {
      yield* m.traverse();
    }
    yield this;
  }

  serialize(depth: number = 0): string {
    let out = '';
    const i = indent(depth);
    if (this.description) {
      out += formatComment(this.description, depth);
    }
    out += i;
    out += `interface ${this.name}`;
    if (this.extends.length) {
      out += ' extends ' + this.extends.join(', ');
    }
    out += ' {\n';
    for (const property of this.properties) {
      out += property.serialize(depth + 1);
    }
    for (const method of this.methods) {
      out += method.serialize(depth + 1);
    }
    if (!out.endsWith('\n')) {
      out += '\n';
    }
    out += `${i}}\n`;
    return out;
  }
}

// A class mixin using the pattern described at:
// https://www.typescriptlang.org/docs/handbook/release-notes/typescript-2-2.html
export class Mixin {
  readonly kind = 'mixin';
  name: string;
  description: string;
  properties: Property[];
  methods: Method[];

  constructor(data: {
    name: string,
    description?: string,
    properties?: Property[],
    methods?: Method[]
  }) {
    this.name = data.name;
    this.description = data.description || '';
    this.properties = data.properties || [];
    this.methods = data.methods || [];
  }

  * traverse(): Iterable<Node> {
    for (const p of this.properties) {
      yield* p.traverse();
    }
    for (const m of this.methods) {
      yield* m.traverse();
    }
    yield this;
  }

  serialize(depth: number = 0): string {
    let out = '';
    const i = indent(depth);
    const i2 = indent(depth + 1);
    if (this.description) {
      out += formatComment(this.description, depth);
    }
    out += i;
    if (depth === 0) {
      out += 'declare ';
    }
    out += `function ${this.name}`;
    out += `<T extends new(...args: any[]) => {}>(base: T): {\n`;
    out += `${i2}new(...args: any[]): {\n`;
    for (const property of this.properties) {
      out += property.serialize(depth + 2);
    }
    for (const method of this.methods) {
      out += method.serialize(depth + 2);
    }
    out += `${i2}}\n`;
    out += `${i}} & T\n`;
    return out;
  }
}

export abstract class FunctionLike {
  kind: string;
  name: string;
  description: string;
  params: Param[];
  returns: Type;

  constructor(data: {
    name: string,
    description?: string,
    params?: Param[],
    returns?: Type
  }) {
    this.name = data.name;
    this.description = data.description || '';
    this.params = data.params || [];
    this.returns = data.returns || anyType;
  }

  serialize(depth: number = 0): string {
    let out = ''
    const i = indent(depth);
    if (this.description) {
      out += '\n' + formatComment(this.description, depth);
    }
    if (depth === 0) {
      out += 'declare ';
    }
    out += i;
    if (this.kind === 'function') {
      out += 'function ';
    }
    out += `${this.name}(`;
    out += this.params.map((p) => p.serialize()).join(', ');
    out += `): ${this.returns.serialize()};\n`;
    return out;
  }
}

export class Function extends FunctionLike {
  readonly kind = 'function';

  * traverse(): Iterable<Node> {
    for (const p of this.params) {
      yield* p.traverse();
    }
    yield* this.returns.traverse();
    yield this;
  }
}

export class Method extends FunctionLike {
  readonly kind = 'method';

  * traverse(): Iterable<Node> {
    for (const p of this.params) {
      yield* p.traverse();
    }
    yield* this.returns.traverse();
    yield this;
  }
}

export class Property {
  readonly kind = 'property';
  name: string;
  description: string;
  type: Type;

  constructor(data: {name: string, description?: string, type?: Type}) {
    this.name = data.name;
    this.description = data.description || '';
    this.type = data.type || anyType;
  }

  * traverse(): Iterable<Node> {
    yield* this.type.traverse();
    yield this;
  }

  serialize(depth: number = 0): string {
    let out = '';
    const i = indent(depth);
    if (this.description) {
      out += '\n' + formatComment(this.description, depth);
    }
    out += `${i}${quotePropertyName(this.name)}: ${this.type.serialize()};\n`;
    return out;
  }
}

export class Param {
  readonly kind = 'param';
  name: string;
  type: Type;
  optional: boolean;
  rest: boolean;

  constructor(
      data: {name: string, type: Type, optional?: boolean, rest?: boolean}) {
    this.name = data.name;
    this.type = data.type || anyType;
    this.optional = data.optional || false;
    this.rest = data.rest || false;
  }

  * traverse(): Iterable<Node> {
    yield* this.type.traverse();
    yield this;
  }

  serialize(): string {
    let out = '';
    if (this.rest) {
      out += '...';
    }
    out += this.name;
    if (this.optional) {
      out += '?';
    }
    out += ': ' + this.type.serialize();
    return out;
  }
}

// A TypeScript type expression.
export type Type = NameType|UnionType|ArrayType|FunctionType;

// string, MyClass, null, undefined, any
export class NameType {
  readonly kind = 'name';
  name: string;

  constructor(name: string) {
    this.name = name;
  };

  * traverse(): Iterable<Node> {
    yield this;
  }

  serialize(): string {
    return this.name;
  }
}

// foo|bar
export class UnionType {
  readonly kind = 'union';
  members: Type[];

  constructor(members: Type[]) {
    this.members = members;
  }

  * traverse(): Iterable<Node> {
    for (const m of this.members) {
      yield* m.traverse();
    }
    yield this;
  }

  /**
   * Simplify this union type:
   *
   * 1) Flatten nested unions (`foo|(bar|baz)` -> `foo|bar|baz`).
   * 2) De-duplicate identical members (`foo|bar|foo` -> `foo|bar`).
   */
  simplify() {
    const flattened = [];
    for (const m of this.members) {
      if (m.kind === 'union') {
        // Note we are not recursing here, because we assume we're being called
        // via a depth-first walk, so any union members have already been
        // simplified.
        flattened.push(...m.members);
      } else {
        flattened.push(m);
      }
    }

    // TODO This only de-dupes Name types. We should de-dupe Arrays and
    // Functions too.
    const deduped = [];
    const names = new Set();
    let hasNull = false;
    let hasUndefined = false;
    for (const m of flattened) {
      if (m.kind === 'name') {
        if (m.name === 'null') {
          hasNull = true;
        } else if (m.name === 'undefined') {
          hasUndefined = true;
        } else if (!names.has(m.name)) {
          deduped.push(m);
          names.add(m.name);
        }
      } else {
        deduped.push(m);
      }
    }
    // Always put `null` and `undefined` at the end because it's more readable.
    // Preserve declared order for everything else.
    if (hasNull) {
      deduped.push(nullType);
    }
    if (hasUndefined) {
      deduped.push(undefinedType);
    }
    this.members = deduped;
  }

  serialize(): string {
    return this.members
        .map((member) => {
          let s = member.serialize();
          if (member.kind === 'function') {
            // The function syntax is ambiguous when part of a union, so add
            // parens (e.g. `() => string|null` vs `(() => string)|null`).
            s = '(' + s + ')';
          }
          return s;
        })
        .join('|');
  }
}

// Array<foo>
export class ArrayType {
  readonly kind = 'array';
  itemType: Type;

  constructor(itemType: Type) {
    this.itemType = itemType;
  }

  * traverse(): Iterable<Node> {
    yield* this.itemType.traverse();
    yield this;
  }

  serialize(): string {
    if (this.itemType.kind === 'name') {
      // Use the concise `foo[]` syntax when the item type is simple.
      return `${this.itemType.serialize()}[]`;
    } else {
      // Otherwise use the `Array<foo>` syntax which is easier to read with
      // complex types (e.g. arrays of arrays).
      return `Array<${this.itemType.serialize()}>`;
    }
  }
}

// (foo: bar) => baz
export class FunctionType {
  readonly kind = 'function';
  params: ParamType[];
  returns: Type;

  constructor(params: ParamType[], returns: Type) {
    this.params = params;
    this.returns = returns;
  }

  * traverse(): Iterable<Node> {
    for (const p of this.params) {
      yield* p.traverse();
    }
    yield* this.returns.traverse();
    yield this;
  }

  serialize(): string {
    const params =
        this.params.map((param) => `${param.name}: ${param.type.serialize()}`);
    return `(${params.join(', ')}) => ${this.returns.serialize()}`;
  }
}

// foo: bar
export class ParamType {
  readonly kind = 'param';
  name: string;
  type: Type;

  * traverse(): Iterable<Node> {
    yield* this.type.traverse();
    yield this;
  }

  constructor(name: string, type: Type) {
    this.name = name;
    this.type = type;
  }
}

export const anyType = new NameType('any');
export const nullType = new NameType('null');
export const undefinedType = new NameType('undefined');

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
