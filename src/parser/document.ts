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

import {correctSourceRange, LocationOffset, SourcePosition, SourceRange, uncorrectSourceRange} from '../model/source-range';
import {ResolvedUrl} from '../model/url';

/**
 * A parsed Document.
 *
 * @template AstNode The AST type of the document.
 * @template Visitor The type of the visitors that can walk the document.
 */
export abstract class ParsedDocument<AstNode = any, Visitor = any> {
  abstract type: string;
  url: ResolvedUrl;
  baseUrl: ResolvedUrl;
  contents: string;
  ast: AstNode;
  isInline: boolean;

  /**
   * If not null, this is an inline document, and astNode is the AST Node of
   * this document inside of the parent. (e.g. the <style> or <script> tag)
   */
  astNode: any;

  sourceRange: SourceRange;

  private readonly _locationOffset: LocationOffset|undefined;

  /**
   * The 0-based offsets into `contents` of all newline characters.
   *
   * Useful for converting between string offsets and SourcePositions.
   */
  readonly newlineIndexes: number[] = [];

  constructor(from: Options<AstNode>) {
    this.url = from.url;
    this.baseUrl = from.baseUrl || this.url;
    this.contents = from.contents;
    this.ast = from.ast;
    this._locationOffset = from.locationOffset;
    this.astNode = from.astNode;
    this.isInline = from.isInline;

    let lastSeenLine = -1;
    while (true) {
      lastSeenLine = from.contents.indexOf('\n', lastSeenLine + 1);
      if (lastSeenLine === -1) {
        break;
      }
      this.newlineIndexes.push(lastSeenLine);
    }
    this.sourceRange = this.offsetsToSourceRange(0, this.contents.length);
  }

  /**
   * Runs a set of document-type specific visitors against the document.
   */
  abstract visit(visitors: Visitor[]): void;

  sourceRangeForNode(node: AstNode): SourceRange|undefined {
    const baseSource = this._sourceRangeForNode(node);
    return this.relativeToAbsoluteSourceRange(baseSource);
  };

  protected abstract _sourceRangeForNode(node: AstNode): SourceRange|undefined;

  /**
   * Convert `this.ast` back into a string document.
   */
  abstract stringify(options: StringifyOptions): string;

  offsetToSourcePosition(offset: number): SourcePosition {
    const linesLess = binarySearch(offset, this.newlineIndexes);
    let colOffset = this.newlineIndexes[linesLess - 1];
    if (colOffset == null) {
      colOffset = 0;
    } else {
      colOffset = colOffset + 1;
    }
    return {line: linesLess, column: offset - colOffset};
  }

  offsetsToSourceRange(start: number, end: number): SourceRange {
    const sourceRange = {
      file: this.url,
      start: this.offsetToSourcePosition(start),
      end: this.offsetToSourcePosition(end)
    };
    return correctSourceRange(sourceRange, this._locationOffset)!;
  }

  sourcePositionToOffset(position: SourcePosition): number {
    const line = Math.max(0, position.line);
    let lineOffset;
    if (line === 0) {
      lineOffset = -1;
    } else if (line > this.newlineIndexes.length) {
      lineOffset = this.contents.length - 1;
    } else {
      lineOffset = this.newlineIndexes[line - 1];
    }
    const result = position.column + lineOffset + 1;
    // Clamp within bounds.
    return Math.min(Math.max(0, result), this.contents.length);
  }

  relativeToAbsoluteSourceRange(sourceRange: SourceRange): SourceRange;
  relativeToAbsoluteSourceRange(sourceRange: undefined): undefined;
  relativeToAbsoluteSourceRange(sourceRange: SourceRange|undefined): SourceRange
      |undefined;
  relativeToAbsoluteSourceRange(sourceRange: SourceRange|undefined): SourceRange
      |undefined {
    return correctSourceRange(sourceRange, this._locationOffset);
  }


  absoluteToRelativeSourceRange(sourceRange: SourceRange): SourceRange;
  absoluteToRelativeSourceRange(sourceRange: undefined): undefined;
  absoluteToRelativeSourceRange(sourceRange: SourceRange|undefined): SourceRange
      |undefined;
  absoluteToRelativeSourceRange(sourceRange: SourceRange|undefined): SourceRange
      |undefined {
    return uncorrectSourceRange(sourceRange, this._locationOffset);
  }

  sourceRangeToOffsets(range: SourceRange): [number, number] {
    return [
      this.sourcePositionToOffset(range.start),
      this.sourcePositionToOffset(range.end)
    ];
  }

  toString() {
    if (this.isInline) {
      return `Inline ${this.constructor.name} on line ` +
          `${this.sourceRange.start.line} of ${this.url}`;
    }
    return `${this.constructor.name} at ${this.url}`;
  }
}

export interface Options<A> {
  url: ResolvedUrl;
  baseUrl?: ResolvedUrl;
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
  inlineDocuments?: ParsedDocument[];
}

/**
 * The variant of binary search that returns the number of elements in the
 * array that is strictly less than the target.
 */
function binarySearch(target: number, arr: number[]) {
  let lower = 0;
  let upper = arr.length - 1;
  while (true) {
    if (lower > upper) {
      return lower;
    }
    const m = Math.floor((upper + lower) / 2);
    if (target === arr[m]) {
      return m;
    }
    if (target > arr[m]) {
      lower = m + 1;
    } else {
      upper = m - 1;
    }
  }
}
