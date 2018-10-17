/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 *
 * This code may only be used under the BSD style license found at
 * polymer.github.io/LICENSE.txt The complete set of authors may be found at
 * polymer.github.io/AUTHORS.txt The complete set of contributors may be found
 * at polymer.github.io/CONTRIBUTORS.txt Code distributed by Google as part of
 * the polymer project is also subject to an additional IP rights grant found at
 * polymer.github.io/PATENTS.txt
 */
import {FormattingOptions, pretty} from './formatting.js';
import {parse, ParsedLine} from './parsing.js';

export type ErrorLikeThing = Error&{
  parsedStack?: string[];
  description?: string;
  fileName?: string;
  lineNumber?: number;
  columnNumber?: number;
};

export function normalize(
    error: ErrorLikeThing, prettyOptions: FormattingOptions): ErrorLikeThing {
  if (error.parsedStack) {
    return error;
  }
  const message =
      error.message || error.description || error || '<unknown error>';
  let parsedStack: ParsedLine[] = [];
  try {
    parsedStack = parse(error.stack || error.toString());
  } catch (error) {
    // Ah well.
  }

  if (parsedStack.length === 0 && error.fileName) {
    parsedStack.push({
      method: '',
      location: error.fileName,
      line: error.lineNumber,
      column: error.columnNumber,
    });
  }

  if (!prettyOptions || !prettyOptions.showColumns) {
    for (let i = 0, line; line = parsedStack[i]; i++) {
      delete line.column;
    }
  }

  let prettyStack = message;
  if (parsedStack.length > 0) {
    prettyStack = prettyStack + '\n' + pretty(parsedStack, prettyOptions);
  }

  const cleanErr = Object.create(Error.prototype);
  cleanErr.message = message;
  cleanErr.stack = prettyStack;
  cleanErr.parsedStack = parsedStack;

  return cleanErr;
}
