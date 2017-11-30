/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {SourceRange} from '../model/model';
import {Options, ParsedDocument} from '../parser/document';

export type Json = JsonObject|JsonArray|number|string|boolean|null;
export interface JsonObject { [key: string]: Json; }
export interface JsonArray extends Array<Json> {}

export interface Visitor { visit(node: Json): void; }

export class ParsedJsonDocument extends ParsedDocument<Json, Visitor> {
  type = 'json';

  constructor(from: Options<Json>) {
    super(from);
  }

  visit(visitors: Visitor[]) {
    this._visit(this.ast, visitors);
  }

  private _visit(node: Json, visitors: Visitor[]) {
    for (const visitor of visitors) {
      visitor.visit(node);
    };
    if (Array.isArray(node)) {
      for (const value of node) {
        this._visit(value, visitors);
      }
    } else if (typeof node === 'object' && node !== null) {
      for (const value of Object.values(node)) {
        this._visit(value, visitors);
      }
    }
  }

  protected _sourceRangeForNode(_node: Json): SourceRange {
    throw new Error('Not Implemented.');
  }

  stringify() {
    return JSON.stringify(this.ast, null, 2);
  }
}
