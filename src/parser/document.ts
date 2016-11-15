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

import {correctSourceRange, LocationOffset, SourceRange} from '../model/source-range';

/**
 * A parsed Document.
 *
 * @template A The AST type of the document
 * @template V The Visitor type of the document
 */
export abstract class ParsedDocument<A, V> {
  abstract type: string;
  url: string;
  contents: string;
  ast: A;
  isInline: boolean;

  /**
   * If not null, this is an inline document, and astNode is the AST Node of
   * this document inside of the parent. (e.g. the <style> or <script> tag)
   */
  astNode: any;

  private _locationOffset: LocationOffset|undefined;

  constructor(from: Options<A>) {
    this.url = from.url;
    this.contents = from.contents;
    this.ast = from.ast;
    this._locationOffset = from.locationOffset;
    this.astNode = from.astNode;
    this.isInline = from.isInline;
  }

  /**
   * Runs a set of document-type specific visitors against the document.
   */
  abstract visit(visitors: V[]): void;

  /**
   * Calls `callback` for each AST node in the document in document order.
   *
   * Implementations _must_ call the callback with every node, and must do so
   * in document order.
   */
  abstract forEachNode(callback: (node: A) => void): void;

  sourceRangeForNode(node: A): SourceRange|undefined {
    const baseSource = this._sourceRangeForNode(node);
    return correctSourceRange(baseSource, this._locationOffset);
  };

  protected abstract _sourceRangeForNode(node: A): SourceRange|undefined;

  /**
   * Convert `this.ast` back into a string document.
   */
  abstract stringify(options: StringifyOptions): string;
}

export interface Options<A> {
  url: string;
  contents: string;
  ast: A;
  locationOffset: LocationOffset|undefined;
  astNode: any|null;
  isInline: boolean;
}

export interface StringifyOptions {
  /** The desired level of indentation of to stringify at. */
  indent?: number;

  /**
   * Parsed (and possibly modified) documents that exist inside this document
   * whose stringified contents should be used instead of what is in `ast`.
   */
  inlineDocuments?: ParsedDocument<any, any>[];
}
