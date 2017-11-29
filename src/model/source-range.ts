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

/**
 * Describes a range of text within a source file.
 *
 * NOTE: `line` and `column` Position properties are indexed from zero. Consider
 * displaying them to users as one-indexed numbers to match text editor
 * conventions.
 */
export interface SourceRange {
  /* The resolved path to the file. */
  readonly file: string;
  readonly start: SourcePosition;
  readonly end: SourcePosition;
}

export interface SourcePosition {
  /** The line number, starting from zero. */
  readonly line: number;
  /** The column offset within the line, starting from zero. */
  readonly column: number;
}

export interface LocationOffset {
  /** Zero based line index. */
  readonly line: number;
  /** Zero based column index. */
  readonly col: number;
  /**
   * The url of the source file.
   */
  readonly filename?: string;
}

/**
 * Corrects source ranges based on an offset.
 *
 * Source ranges for inline documents need to be corrected relative to their
 * positions in their containing documents.
 *
 * For example, if a <script> tag appears in the fifth line of its containing
 * document, we need to move all the source ranges inside that script tag down
 * by 5 lines. We also need to correct the column offsets, but only for the
 * first line of the <script> contents.
 */
export function correctSourceRange(
    sourceRange: SourceRange,
    locationOffset?: LocationOffset|null): SourceRange;
export function correctSourceRange(
    sourceRange: undefined, locationOffset?: LocationOffset|null): undefined;
export function correctSourceRange(
    sourceRange?: SourceRange,
    locationOffset?: LocationOffset|null): SourceRange|undefined;
export function correctSourceRange(
    sourceRange?: SourceRange,
    locationOffset?: LocationOffset|null): SourceRange|undefined {
  if (!locationOffset || !sourceRange) {
    return sourceRange;
  }
  return {
    file: locationOffset.filename || sourceRange.file,
    start: correctPosition(sourceRange.start, locationOffset),
    end: correctPosition(sourceRange.end, locationOffset)
  };
}

export function correctPosition(
    position: SourcePosition, locationOffset: LocationOffset): SourcePosition {
  return {
    line: position.line + locationOffset.line,
    column: position.column + (position.line === 0 ? locationOffset.col : 0)
  };
}

export function uncorrectSourceRange(
    sourceRange?: SourceRange,
    locationOffset?: LocationOffset|null): SourceRange|undefined {
  if (locationOffset == null || sourceRange == null) {
    return sourceRange;
  }
  return {
    file: locationOffset.filename || sourceRange.file,
    start: uncorrectPosition(sourceRange.start, locationOffset),
    end: uncorrectPosition(sourceRange.end, locationOffset),
  };
}

export function uncorrectPosition(
    position: SourcePosition, locationOffset: LocationOffset): SourcePosition {
  const line = position.line - locationOffset.line;
  return {
    line: line,
    column: position.column - (line === 0 ? locationOffset.col : 0)
  };
}

/**
 * Returns -1 if source position `a` comes before source position `b`, returns 0
 * if they are the same, returns 1 if `a` comes after `b`.
 */
export function comparePosition(a: SourcePosition, b: SourcePosition): number {
  if (a.line !== b.line) {
    return a.line < b.line ? -1 : 1;
  }
  if (a.column !== b.column) {
    return a.column < b.column ? -1 : 1;
  }
  return 0;
}

/**
 * If the position is inside the range, returns 0. If it comes before the range,
 * it returns -1. If it comes after the range, it returns 1.
 *
 * TODO(rictic): test this method directly (currently most of its tests are
 *   indirectly, through ast-from-source-position).
 */
export function comparePositionAndRange(
    position: SourcePosition, range: SourceRange, includeEdges?: boolean) {
  // Usually we want to include the edges of a range as part
  // of the thing, but sometimes, e.g. for start and end tags,
  // we'd rather not.
  if (includeEdges == null) {
    includeEdges = true;
  }
  if (includeEdges == null) {
    includeEdges = true;
  }
  if (position.line < range.start.line) {
    return -1;
  }
  if (position.line > range.end.line) {
    return 1;
  }
  if (position.line === range.start.line) {
    if (includeEdges) {
      if (position.column < range.start.column) {
        return -1;
      }
    } else {
      if (position.column <= range.start.column) {
        return -1;
      }
    }
  }
  if (position.line === range.end.line) {
    if (includeEdges) {
      if (position.column > range.end.column) {
        return 1;
      }
    } else {
      if (position.column >= range.end.column) {
        return 1;
      }
    }
  }
  return 0;
}

export function isPositionInsideRange(
    position: SourcePosition,
    range: SourceRange|undefined,
    includeEdges?: boolean) {
  if (!range) {
    return false;
  }
  return comparePositionAndRange(position, range, includeEdges) === 0;
}
