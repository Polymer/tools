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
