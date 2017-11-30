/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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
import {assert} from 'chai';

import {SourceRange} from '../../model/model';
import {ResolvedUrl} from '../../model/url';
import {ParsedDocument, StringifyOptions} from '../../parser/document';

class TestDocument extends ParsedDocument<null, null> {
  type: string;
  visit(_visitors: null[]): void {
    throw new Error('Method not implemented.');
  }
  protected _sourceRangeForNode(_node: null): SourceRange|undefined {
    throw new Error('Method not implemented.');
  }
  stringify(_options: StringifyOptions): string {
    throw new Error('Method not implemented.');
  }

  constructor(contents: string) {
    super({
      ast: null,
      astNode: null,
      baseUrl: 'test-document' as ResolvedUrl,
      contents,
      isInline: false,
      locationOffset: undefined,
      url: 'test-document' as ResolvedUrl
    });
  }
}

suite('ParsedDocument', () => {
  /**
   * We have pretty great tests of offsetsToSourceRange just because it's used
   * so much in ParsedHtmlDocument, which has tons of tests. So we can get good
   * tests of sourceRangeToOffsets by ensuring that they're inverses of one
   * another.
   */
  const testName =
      'offsetsToSourceRange is the inverse of sourceRangeToOffsets for ' +
      'in-bounds ranges';
  test(testName, async () => {
    const contents = [``, `asdf`, `a\na`, `asdf\n\nasdf`, `\nasdf\n`];
    for (const content of contents) {
      const document = new TestDocument(content);
      for (let start = 0; start < content.length; start++) {
        for (let end = start; end < content.length; end++) {
          const range = document.offsetsToSourceRange(start, end);
          const offsets = document.sourceRangeToOffsets(range);
          assert.deepEqual(offsets, [start, end]);
        }
      }
    }
  });

  test('sourcePositionToOffsets clamps out of bounds values', async () => {
    const document = new TestDocument(`abc\ndef`);
    assert.deepEqual(document.sourcePositionToOffset({line: 0, column: -1}), 0);
    assert.deepEqual(
        document.sourcePositionToOffset({line: 1, column: -10}), 0);
    assert.deepEqual(document.sourcePositionToOffset({line: 5, column: 0}), 7);
    assert.deepEqual(document.sourcePositionToOffset({line: 1, column: 12}), 7);
  });

  test('sourceRangeToOffsets works for simple cases', async () => {
    let document = new TestDocument('ab');
    assert.deepEqual(document.offsetToSourcePosition(0), {line: 0, column: 0});
    assert.deepEqual(document.offsetToSourcePosition(1), {line: 0, column: 1});
    assert.deepEqual(document.offsetToSourcePosition(2), {line: 0, column: 2});
    document = new TestDocument('\n\n');
    assert.deepEqual(document.offsetToSourcePosition(0), {line: 0, column: 0});
    assert.deepEqual(document.offsetToSourcePosition(1), {line: 1, column: 0});
    assert.deepEqual(document.offsetToSourcePosition(2), {line: 2, column: 0});
    document = new TestDocument('a\nb\nc');
    assert.deepEqual(document.offsetToSourcePosition(0), {line: 0, column: 0});
    assert.deepEqual(document.offsetToSourcePosition(1), {line: 0, column: 1});
    assert.deepEqual(document.offsetToSourcePosition(2), {line: 1, column: 0});
    assert.deepEqual(document.offsetToSourcePosition(3), {line: 1, column: 1});
    assert.deepEqual(document.offsetToSourcePosition(4), {line: 2, column: 0});
    assert.deepEqual(document.offsetToSourcePosition(5), {line: 2, column: 1});
  });

  test('sourceRangeToOffsets fails gracefully', async () => {
    let document = new TestDocument('ab');
    assert.deepEqual(
        document.offsetToSourcePosition(-1), {line: 0, column: -1});
    assert.deepEqual(document.offsetToSourcePosition(3), {line: 0, column: 3});
    assert.deepEqual(document.offsetToSourcePosition(4), {line: 0, column: 4});
    document = new TestDocument('\n\n');
    assert.deepEqual(
        document.offsetToSourcePosition(-1), {line: 0, column: -1});
    assert.deepEqual(document.offsetToSourcePosition(3), {line: 2, column: 1});
    assert.deepEqual(document.offsetToSourcePosition(4), {line: 2, column: 2});
  });
});
