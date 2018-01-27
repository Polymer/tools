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

export type Node = Document|Declaration|Method|Type|Property;

// An AST node that can appear directly in a document or namespace.
export type Declaration = Namespace|Class|Interface|Function|ConstValue;

export class Document {
  readonly kind = 'document';
  path: string;
  members: Declaration[];
  referencePaths: Set<string>;
  header: string;

  constructor(data: {
    path: string,
    members?: Declaration[],
    referencePaths?: Iterable<string>,
    header?: string
  }) {
    this.path = data.path;
    this.members = data.members || [];
    this.referencePaths = new Set(Array.from(data.referencePaths || []));
    this.header = data.header || '';
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
    if (this.header) {
      out += formatComment(this.header, 0) + '\n';
    }
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
  description: string;
  members: Declaration[];

  constructor(data: {
    name: string,
    description?: string,
    members?: Declaration[],
  }) {
    this.name = data.name;
    this.description = data.description || '';
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
    if (this.description) {
      out += formatComment(this.description, depth);
    }
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

export abstract class FunctionLike {
  kind: string;
  name: string;
  description: string;
  params: ParamType[];
  templateTypes: string[];
  returns: Type;
  returnsDescription: string;
  isStatic: boolean;

  constructor(data: {
    name: string,
    description?: string,
    params?: ParamType[],
    templateTypes?: string[],
    returns?: Type,
    returnsDescription?: string,
    isStatic?: boolean,
  }) {
    this.name = data.name;
    this.description = data.description || '';
    this.params = data.params || [];
    this.returns = data.returns || anyType;
    this.templateTypes = data.templateTypes || [];
    this.returnsDescription = data.returnsDescription || '';
    this.isStatic = data.isStatic || false;
  }

  serialize(depth: number = 0): string {
    let out = ''
    const i = indent(depth);

    const annotations = [];
    for (const p of this.params) {
      if (p.description) {
        annotations.push(`@param ${p.name} ${p.description}`);
      }
    }
    if (this.returnsDescription) {
      annotations.push(`@returns ${this.returnsDescription}`);
    }

    let combinedDescription = this.description;
    if (annotations.length > 0) {
      if (combinedDescription) {
        combinedDescription += '\n\n';
      }
      combinedDescription += annotations.join('\n');
    }
    if (combinedDescription) {
      out += '\n' + formatComment(combinedDescription, depth);
    }

    out += i;
    if (depth === 0) {
      out += 'declare ';
    }
    if (this.kind === 'method' && this.isStatic) {
      out += 'static ';
    }
    if (this.kind === 'function') {
      out += 'function ';
    }
    out += this.name;
    if (this.templateTypes.length > 0) {
      out += `<${this.templateTypes.join(', ')}>`;
    }
    out += '(';
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
  readOnly: boolean;

  constructor(data: {
    name: string,
    description?: string,
    type?: Type,
    readOnly?: boolean,
  }) {
    this.name = data.name;
    this.description = data.description || '';
    this.type = data.type || anyType;
    this.readOnly = data.readOnly || false;
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
    out += i;
    if (this.readOnly) {
      out += 'readonly ';
    }
    out += `${quotePropertyName(this.name)}: ${this.type.serialize()};\n`;
    return out;
  }
}

export class ConstValue {
  readonly kind = 'constValue';
  name: string;
  type: Type;

  constructor(data: {
    name: string,
    type: Type,
  }) {
    this.name = data.name;
    this.type = data.type;
  }

  * traverse(): Iterable<Node> {
    yield* this.type.traverse();
    yield this;
  }

  serialize(depth: number = 0): string {
    return `${indent(depth)}const ${this.name}: ${this.type.serialize()};\n`;
  }
}

// A TypeScript type expression.
export type Type = NameType|UnionType|ArrayType|FunctionType|ConstructorType|
    RecordType|IntersectionType|IndexableObjectType|ParamType|ParameterizedType;

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

// Foo<Bar>
export class ParameterizedType {
  readonly kind = 'parameterized';
  itemTypes: Type[];
  name: string;

  constructor(name: string, itemTypes: Type[]) {
    this.name = name;
    this.itemTypes = itemTypes;
  }

  * traverse(): Iterable<Node> {
    for (const itemType of this.itemTypes) {
      yield* itemType.traverse();
    }
    yield this;
  }

  serialize(): string {
    const types = this.itemTypes.map((t) => t.serialize());
    return `${this.name}<${types.join(', ')}>`;
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
    const params = this.params.map((param) => param.serialize());
    return `(${params.join(', ')}) => ${this.returns.serialize()}`;
  }
}

// {new(foo): bar}
export class ConstructorType {
  readonly kind = 'constructor';
  params: ParamType[];
  returns: NameType;

  constructor(params: ParamType[], returns: NameType) {
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
    const params = this.params.map((param) => param.serialize());
    return `{new(${params.join(', ')}): ${this.returns.serialize()}}`;
  }
}

// foo: bar
export class ParamType {
  readonly kind = 'param';
  name: string;
  type: Type;
  optional: boolean;
  rest: boolean;
  description: string;

  constructor(data: {
    name: string,
    type: Type,
    optional?: boolean,
    rest?: boolean,
    description?: string
  }) {
    this.name = data.name;
    this.type = data.type || anyType;
    this.optional = data.optional || false;
    this.rest = data.rest || false;
    this.description = data.description || '';
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

export class RecordType {
  readonly kind = 'record';
  fields: ParamType[];

  constructor(fields: ParamType[]) {
    this.fields = fields;
  }

  * traverse(): Iterable<Node> {
    for (const f of this.fields) {
      yield* f.traverse();
    }
    yield this;
  }

  serialize(): string {
    const fields = this.fields.map((field) => field.serialize());
    return `{${fields.join(', ')}}`;
  }
}

export class IntersectionType {
  readonly kind = 'intersection';
  types: Type[];

  constructor(types: Type[]) {
    this.types = types;
  }

  * traverse(): Iterable<Node> {
    for (const t of this.types) {
      yield* t.traverse();
    }
    yield this;
  }

  serialize(): string {
    return this.types.map((t) => t.serialize()).join(' & ');
  }
}

export class IndexableObjectType {
  readonly kind = 'indexableObject';
  keyType: Type;
  valueType: Type;

  constructor(keyType: Type, valueType: Type) {
    this.keyType = keyType;
    this.valueType = valueType;
  }

  * traverse(): Iterable<Node> {
    yield* this.keyType.traverse();
    yield* this.valueType.traverse();
    yield this;
  }

  serialize(): string {
    return `{[key: ${this.keyType.serialize()}]: ${this.valueType.serialize()}}`
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
  // Make sure we don't end our comment early by printing out the `*/` end
  // comment sequence if it is contained in the comment. Escape it as `*\/`
  // instead. One way this sequence could get here is if an HTML comment
  // embedded a JavaScript style block comment.
  comment = comment.replace(/\*\//g, '*\\/')

  // Indent the comment one space so that it doesn't touch the `*` we add next,
  // but only if there is a character there. If we also indented blank lines by
  // one space, then they would have an unneccessary space after the `*`.
  comment = comment.replace(/^(.)/gm, ' $1')

  // Indent to the given level and add the `*` character.
  const i = indent(depth);
  comment = comment.replace(/^/gm, `${i} *`);

  return `${i}/**\n${comment}\n${i} */\n`;
}
