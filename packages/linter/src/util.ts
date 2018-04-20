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

import * as levenshtein from 'fast-levenshtein';
import {Document, isPositionInsideRange, ParsedDocument, Replacement, SourceRange} from 'polymer-analyzer';

import stripIndent = require('strip-indent');

/**
 * A utility for more easily writing long strings inline in code.
 *
 * Strips leading and trailing whitespace, and converts newlines followed
 * by whitespace into a single space. Use like:
 *
 *     stripWhitespace(`
 *         hello
 *         world
 *     `);
 *
 * This evaluates to "hello world".
 */
export function stripWhitespace(str: string) {
  return str.trim().replace(/\s*\n\s*/g, ' ');
}

/**
 * A utility for writing long multiline strings inline in code.
 *
 * Determines the initial indentation based on the first indented line,
 * and removes it from all other lines, then trims off leading and trailing
 * whitespace. Use like:
 *
 *     stripIndentation(`
 *         hello
 *           world
 *     `);
 *
 * This evaluates to "hello\n  world"
 */
export function stripIndentation(str: string) {
  return stripIndent(str).trim();
}

export function minBy<T>(it: Iterable<T>, score: (t: T) => number) {
  let min = undefined;
  let minScore = undefined;
  for (const val of it) {
    const valScore = score(val);
    if (minScore === undefined || valScore < minScore) {
      minScore = valScore;
      min = val;
    }
  }
  if (minScore === undefined) {
    return undefined;
  }
  return {min: min as T, minScore};
}

export function closestSpelling(word: string, options: Iterable<string>) {
  return minBy(options, (option) => levenshtein.get(word, option));
}

// TODO(43081j): this exists already in the analyzer's analysis
// namespace. We should remove this function and import it instead
// once it has been exposed in a future analyzer release.
export function getDocumentContaining(
    sourceRange: SourceRange|undefined, document: Document): ParsedDocument|
    undefined {
  if (!sourceRange) {
    return undefined;
  }
  let mostSpecificDocument: undefined|Document = undefined;
  for (const doc of document.getFeatures({kind: 'document'})) {
    if (isPositionInsideRange(sourceRange.start, doc.sourceRange)) {
      if (!mostSpecificDocument ||
          isPositionInsideRange(
              doc.sourceRange!.start, mostSpecificDocument.sourceRange)) {
        mostSpecificDocument = doc;
      }
    }
  }
  mostSpecificDocument = mostSpecificDocument || document;
  return mostSpecificDocument.parsedDocument;
}

/**
 * A utility for indenting a sourceRange
 */
export function indentSourceRange(
    sourceRange: SourceRange, indentation: string, _document: ParsedDocument) {
  const fixes: Replacement[] = [];
  for (let i = sourceRange.start.line; i <= sourceRange.end.line; i++) {
    const sourcePosition = {
      line: i,
      column: sourceRange.start.column,
    };
    fixes.push({
      range: {
        file: _document.url,
        start: sourcePosition,
        end: sourcePosition,
      },
      replacementText: indentation
    });
  }
  return fixes;
}
