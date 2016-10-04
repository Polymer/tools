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
  file: string;
  start: Position;
  end: Position;
}

export interface Position {
  /** The line number, starting from zero. */
  line: number;
  /** The column offset within the line, starting from zero. */
  column: number;
}

export interface LocationOffset {
  /** Zero based line index. */
  line: number;
  /** Zero based column index. */
  col: number;
  /**
   * The url of the source file.
   */
  filename?: string;
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
    position: Position, locationOffset: LocationOffset): Position {
  return {
    line: position.line + locationOffset.line,
    column: position.column + (position.line === 0 ? locationOffset.col : 0)
  };
}
