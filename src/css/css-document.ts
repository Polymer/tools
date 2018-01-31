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

import * as shady from 'shady-css-parser';

import {SourceRange} from '../model/model';
import {ParsedDocument, StringifyOptions} from '../parser/document';

import cssbeautify = require('cssbeautify');

export interface Visitor { visit(node: shady.Node): void; }

export class ParsedCssDocument extends ParsedDocument<shady.Node, Visitor> {
  readonly type = 'css';

  visit(visitors: Visitor[]) {
    for (const node of this) {
      for (const visitor of visitors) {
        visitor.visit(node);
      }
    }
  }

  sourceRangeForNode(node: shady.Node): SourceRange {
    return this.sourceRangeForShadyRange(node.range);
  }

  /**
   * Takes a range from a shadycss node directly, rather than a shadycss node.
   * Useful when there are multiple ranges for a given node.
   */
  sourceRangeForShadyRange(range: shady.Range): SourceRange {
    return this.offsetsToSourceRange(range.start, range.end);
  }

  protected _sourceRangeForNode(node: shady.Node): SourceRange {
    return this.sourceRangeForShadyRange(node.range);
  }

  stringify(options?: StringifyOptions) {
    options = options || {};
    shadyStringifier.visit;
    const beautifulResults = cssbeautify(
        shadyStringifier.stringify(this.ast),
        {indent: '  ', autosemicolon: true, openbrace: 'end-of-line'});

    const indent = '  '.repeat(options.indent || 0);

    return beautifulResults.split('\n')
               .map((line) => line === '' ? '' : indent + line)
               .join('\n') +
        '\n';
  }

  * [Symbol.iterator](): Iterator<shady.Node> {
    yield* shady.iterateOverAst(this.ast);
  }
}

const shadyStringifier = new shady.Stringifier();
