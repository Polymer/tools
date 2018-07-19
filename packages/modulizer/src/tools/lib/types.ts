/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

export class Def {
  _name: string;
  _bases: string[]|undefined;
  _fields = new Map<string, Field>();
  _build: string[]|undefined;

  constructor(name: string) {
    this._name = name;
  }

  bases(...bases: string[]) {
    this._bases = bases;
    return this;
  }

  field(name: string, type: TypeDef, default_?: {}) {
    this._fields.set(name, {
      name,
      type,
      default: default_,
    });
    return this;
  }

  build(...fields: string[]) {
    this._build = fields;
    return this;
  }
}

export class Or {
  types: TypeDef[];

  constructor(types: TypeDef[]) {
    this.types = types;
  }
}

export interface Field {
  name: string;
  type: TypeDef;
  default?: ({});
}

type TypeDefSingle = Def|Or|string|StringConstructor|NumberConstructor|
    BooleanConstructor|RegExpConstructor|null;
export type TypeDef = TypeDefSingle|TypeDefSingle[];

export function typeString(type: TypeDef) {
  let isArray = false;
  let name: string;

  if (Array.isArray(type)) {
    isArray = true;
    // arrays are always 1 value, becuase why not?
    type = type[0];
  }

  if (type instanceof Def) {
    name = `estree.${type._name}`;
  } else if (type instanceof Or) {
    name = '(' + type.types.map((t) => typeString(t)).join('|') + ')';
  } else if (type === null) {
    name = 'null';
  } else if (type === String) {
    name = 'string';
  } else if (type === Number) {
    name = 'number';
  } else if (type === Boolean) {
    name = 'boolean';
  } else if (type === RegExp) {
    name = 'RegExp';
  } else {
    name = `'${type}'`;
  }
  return name + (isArray ? '[]' : '');
}

export function nullable(type: TypeDef): boolean {
  if (type == null) {
    return true;
  }
  if (Array.isArray(type)) {
    return nullable(type[0]);
  }
  if (type instanceof Or) {
    return type.types.some((t) => nullable(t));
  }
  return false;
}

class TypeApi {
  types = new Map<string, Def>();

  // Arrow function to support tear-offs
  def =
      (name: string) => {
        let def = this.types.get(name);
        if (def === undefined) {
          def = new Def(name);
          this.types.set(name, def);
        }
        return def;
      }

  or(..._defs: TypeDef[]) {
    return new Or(_defs);
  }
}

export const Type = new TypeApi();
