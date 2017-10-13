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
import {Analyzer, Document, ParsedDocument, UrlLoader} from 'polymer-analyzer';

import {applyEdits, Replacement} from '../warning';

/**
 * TODO(rictic): import these two classes from analyzer once this lands:
 *    https://github.com/Polymer/polymer-analyzer/pull/545
 */
class FailUrlLoader implements UrlLoader {
  canLoad(_url: string): boolean {
    return true;
  }
  load(url: string): Promise<string> {
    throw new Error(`${url} not known in InMemoryOverlayLoader`);
  }
}

/**
 * Resolves requests first from an in-memory map of file contents, and if a
 * file isn't found there, defers to another url loader.
 *
 * Useful for the editor use case. An editor will have a number of files in open
 * buffers at any time. For these files, the editor's in-memory buffer is
 * canonical, so that their contents are read even when they have unsaved
 * changes. For all other files, we can load the files using another loader,
 * e.g. from disk.
 */
export class InMemoryOverlayLoader implements UrlLoader {
  private readonly _fallbackLoader: UrlLoader;
  private readonly _memoryMap = new Map<string, string>();

  constructor(fallbackLoader?: UrlLoader) {
    this._fallbackLoader = fallbackLoader || new FailUrlLoader();
    if (this._fallbackLoader.readDirectory) {
      this.readDirectory =
          this._fallbackLoader.readDirectory.bind(this._fallbackLoader);
    }
  }

  canLoad(url: string): boolean {
    if (this._memoryMap.has(url)) {
      return true;
    }
    return this._fallbackLoader.canLoad(url);
  }

  async load(url: string): Promise<string> {
    const contents = this._memoryMap.get(url);
    if (typeof contents === 'string') {
      return contents;
    }
    return this._fallbackLoader.load(url);
  }

  // We have this method if our underlying loader has it.
  readDirectory?: (pathFromRoot: string, deep?: boolean) => Promise<string[]>;

  mapFile(url: string, contents: string) {
    this._memoryMap.set(url, contents);
  }

  unmapFile(url: string) {
    this._memoryMap.delete(url);
  }
}


suite('applyEdits', () => {
  let memoryMap: InMemoryOverlayLoader;
  let loader: (url: string) => Promise<ParsedDocument<any, any>>;

  setup(() => {
    memoryMap = new InMemoryOverlayLoader();
    memoryMap.mapFile('test.html', 'abc');
    const analyzer = new Analyzer({urlLoader: memoryMap});
    loader = async(url: string) => {
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
        file: 'test.html',
        start: {line: startLine, column: startColumn},
        end: {line: endLine, column: endColumn}
      },
      replacementText
    };
  };

  test('works in the trivial case', async() => {
    const contents = 'abc';
    memoryMap.mapFile('test.html', contents);

    const result = await applyEdits([], loader);
    assert.deepEqual(result.appliedEdits, []);
    assert.deepEqual(result.incompatibleEdits, []);
    assert.deepEqual(Array.from(result.editedFiles.entries()), []);
  });

  test('can apply a simple single edit', async() => {
    const edit = [makeTestReplacement(0, 1, 0, 2, 'd')];
    const result = await applyEdits([edit], loader);
    assert.deepEqual(result.appliedEdits, [edit]);
    assert.deepEqual(result.incompatibleEdits, []);
    assert.deepEqual(
        Array.from(result.editedFiles.entries()), [['test.html', 'adc']]);
  });

  test('can apply two compatible edits', async() => {
    const edit1 = [makeTestReplacement(0, 1, 0, 2, 'd')];
    const edit2 = [makeTestReplacement(0, 2, 0, 3, 'g')];
    const result = await applyEdits([edit1, edit2], loader);
    assert.deepEqual(result.appliedEdits, [edit1, edit2]);
    assert.deepEqual(result.incompatibleEdits, []);
    assert.deepEqual(
        Array.from(result.editedFiles.entries()), [['test.html', 'adg']]);
  });

  test('does not apply an internally inconsistent edit', async() => {
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
  test(testName, async() => {
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
  test(testName, async() => {
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
});
