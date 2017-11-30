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

import {assert} from 'chai';
import {knuthShuffle} from 'knuth-shuffle';

import {Analyzer} from '../../core/analyzer';
import {applyEdits, Document, Replacement} from '../../model/model';
import {ResolvedUrl} from '../../model/url';
import {ParsedDocument} from '../../parser/document';
import {InMemoryOverlayUrlLoader} from '../../url-loader/overlay-loader';

suite('applyEdits', () => {
  let memoryMap: InMemoryOverlayUrlLoader;
  let loader: (url: string) => Promise<ParsedDocument<any, any>>;

  setup(() => {
    memoryMap = new InMemoryOverlayUrlLoader();
    memoryMap.urlContentsMap.set('test.html', 'abc');
    const analyzer = new Analyzer({urlLoader: memoryMap});
    loader = async (url: string) => {
      const analysis = await analyzer.analyze([url]);
      const document = analysis.getDocument(url) as Document;
      return document.parsedDocument;
    };
  });

  function makeTestReplacement(
      startLine: number,
      startColumn: number,
      endLine: number,
      endColumn: number,
      replacementText: string): Replacement {
    return {
      range: {
        file: 'test.html' as ResolvedUrl,
        start: {line: startLine, column: startColumn},
        end: {line: endLine, column: endColumn}
      },
      replacementText
    };
  };

  test('works in the trivial case', async () => {
    const contents = 'abc';
    memoryMap.urlContentsMap.set('test.html', contents);

    const result = await applyEdits([], loader);
    assert.deepEqual(result.appliedEdits, []);
    assert.deepEqual(result.incompatibleEdits, []);
    assert.deepEqual(Array.from(result.editedFiles.entries()), []);
  });

  test('can apply a simple single edit', async () => {
    const edit = [makeTestReplacement(0, 1, 0, 2, 'd')];
    const result = await applyEdits([edit], loader);
    assert.deepEqual(result.appliedEdits, [edit]);
    assert.deepEqual(result.incompatibleEdits, []);
    assert.deepEqual(
        Array.from(result.editedFiles.entries()), [['test.html', 'adc']]);
  });

  test('can apply two compatible edits', async () => {
    const edit1 = [makeTestReplacement(0, 1, 0, 2, 'd')];
    const edit2 = [makeTestReplacement(0, 2, 0, 3, 'g')];
    const result = await applyEdits([edit1, edit2], loader);
    assert.deepEqual(result.appliedEdits, [edit1, edit2]);
    assert.deepEqual(result.incompatibleEdits, []);
    assert.deepEqual(
        Array.from(result.editedFiles.entries()), [['test.html', 'adg']]);
  });

  test('does not apply an internally inconsistent edit', async () => {
    const edit = [
      makeTestReplacement(0, 0, 0, 3, 'def'),
      makeTestReplacement(0, 0, 0, 3, 'ghi'),
    ];
    const result = await applyEdits([edit], loader);
    assert.deepEqual(result.appliedEdits, []);
    assert.deepEqual(result.incompatibleEdits, [edit]);
    assert.deepEqual(Array.from(result.editedFiles.entries()), []);
  });

  let testName = 'takes edits in order, rejecting those incompatible ' +
      'with the accepted ones so far';
  test(testName, async () => {
    const edits = [
      [makeTestReplacement(0, 0, 0, 1, '1')],
      [makeTestReplacement(0, 0, 0, 3, '!!!')],
      [makeTestReplacement(0, 2, 0, 3, '3')],
    ];
    const result = await applyEdits(edits, loader);
    assert.deepEqual(result.appliedEdits, [edits[0], edits[2]]);
    assert.deepEqual(result.incompatibleEdits, [edits[1]]);
    assert.deepEqual(
        Array.from(result.editedFiles.entries()), [['test.html', '1b3']]);
  });

  testName = 'can deal with inserting, replacing and removing characters';
  test(testName, async () => {
    const edits = [
      [makeTestReplacement(0, 0, 0, 0, '0000')],
      [makeTestReplacement(0, 0, 0, 1, '111')],
      [makeTestReplacement(0, 1, 0, 2, '')],
      [makeTestReplacement(0, 2, 0, 3, '33')],
      [makeTestReplacement(0, 3, 0, 3, '4')],
    ];
    // These edits are valid from any order, try a bunch of them.
    for (let _ = 0; _ < 1000; _++) {
      const shuffledEdits = Array.from(edits);
      knuthShuffle(shuffledEdits);
      const result = await applyEdits(shuffledEdits, loader);
      assert.deepEqual(result.appliedEdits, shuffledEdits);
      assert.deepEqual(result.incompatibleEdits, []);
      assert.deepEqual(
          Array.from(result.editedFiles.entries()),
          [['test.html', '0000111334']]);
    }
  });

  testName = 'can do two inserts into the same location without conflict';
  test(testName, async () => {
    const edits = [
      [makeTestReplacement(0, 0, 0, 0, 'xxxx')],
      [makeTestReplacement(0, 0, 0, 0, 'yyyy')],
    ];
    const result = await applyEdits(edits, loader);
    assert.deepEqual(result.appliedEdits, edits);
    assert.deepEqual(result.incompatibleEdits, []);
    assert.deepEqual(
        Array.from(result.editedFiles.entries()),
        [['test.html', 'yyyyxxxxabc']]);
  });
});
