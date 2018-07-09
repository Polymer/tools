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

import {formatComment, indent, quotePropertyName} from './formatting';
import {Node} from './index';
import {anyType, ParamType, Type} from './types';

// An AST node that can appear directly in a document or namespace.
export type Declaration = Namespace|Class|Interface|Function|ConstValue;

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
    let out = '';
    if (this.description) {
      out += formatComment(this.description, depth);
    }
    const i = indent(depth);
    out += i;
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
  constructorMethod?: Method;

  constructor(data: {
    name: string,
    description?: string,
    extends?: string,
    mixins?: string[],
    properties?: Property[],
    methods?: Method[],
    constructorMethod?: Method
  }) {
    this.name = data.name;
    this.description = data.description || '';
    this.extends = data.extends || '';
    this.mixins = data.mixins || [];
    this.properties = data.properties || [];
    this.methods = data.methods || [];
    this.constructorMethod = data.constructorMethod;
  }

  * traverse(): Iterable<Node> {
    for (const p of this.properties) {
      yield* p.traverse();
    }
    if (this.constructorMethod) {
      yield* this.constructorMethod.traverse();
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
      out += ')'.repeat(this.mixins.length);

    } else if (this.extends) {
      out += ' extends ' + this.extends;
    }

    out += ' {\n';
    for (const property of this.properties) {
      out += property.serialize(depth + 1);
    }
    if (this.constructorMethod) {
      out += this.constructorMethod.serialize(depth + 1);
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
  kind?: 'method'|'function';
  name: string;
  description: string;
  params: ParamType[];
  templateTypes: string[];
  returns?: Type;
  returnsDescription: string;
  isStatic: boolean;
  ignoreTypeCheck: boolean;

  constructor(data: {
    name: string,
    description?: string,
    params?: ParamType[],
    templateTypes?: string[],
    returns?: Type,
    returnsDescription?: string,
    isStatic?: boolean,
    ignoreTypeCheck?: boolean,
  }) {
    this.name = data.name;
    this.description = data.description || '';
    this.params = data.params || [];
    this.returns = data.returns || anyType;
    this.templateTypes = data.templateTypes || [];
    this.returnsDescription = data.returnsDescription || '';
    this.isStatic = data.isStatic || false;
    this.ignoreTypeCheck = data.ignoreTypeCheck || false;
  }

  serialize(depth: number = 0): string {
    let out = '';
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
    if (this.ignoreTypeCheck) {
      out += indent(depth) + '// @ts-ignore\n';
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
    out += `)`;
    if (this.returns) {
      out += `: ${this.returns.serialize()}`;
    }
    out += `;\n`;
    return out;
  }
}

export class Function extends FunctionLike {
  readonly kind = 'function';

  * traverse(): Iterable<Node> {
    for (const p of this.params) {
      yield* p.traverse();
    }
    if (this.returns) {
      yield* this.returns.traverse();
    }
    yield this;
  }
}

export class Method extends FunctionLike {
  readonly kind = 'method';

  * traverse(): Iterable<Node> {
    for (const p of this.params) {
      yield* p.traverse();
    }
    if (this.returns) {
      yield* this.returns.traverse();
    }
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
