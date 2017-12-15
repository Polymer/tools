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

import {Analyzer} from '../../core/analyzer';
import {ScannedImport} from '../../index';
import {TypeScriptImportScanner} from '../../typescript/typescript-import-scanner';
import {TypeScriptPreparser} from '../../typescript/typescript-preparser';
import {InMemoryOverlayUrlLoader} from '../../url-loader/overlay-loader';
import {runScanner} from '../test-utils';

suite('TypeScriptImportScanner', () => {
  test('finds no imports', async () => {
    const urlLoader = new InMemoryOverlayUrlLoader();
    const analyzer = new Analyzer(
        {parsers: new Map([['ts', new TypeScriptPreparser()]]), urlLoader});
    urlLoader.urlContentsMap.set(analyzer.resolveUrl('test.ts')!, '');
    const {features} =
        await runScanner(analyzer, new TypeScriptImportScanner(), 'test.ts');
    assert.equal(features.length, 0);
  });

  test('finds multiple import', async () => {
    const source = `
        import * as x from './x.ts';
        import * as y from '/y.ts';
        import * as z from '../z.ts';
      `;
    const urlLoader = new InMemoryOverlayUrlLoader();
    const analyzer = new Analyzer(
        {parsers: new Map([['ts', new TypeScriptPreparser()]]), urlLoader});
    urlLoader.urlContentsMap.set(analyzer.resolveUrl('test.ts')!, source);
    const {features} =
        await runScanner(analyzer, new TypeScriptImportScanner(), 'test.ts');
    assert.deepEqual(features.map((f: ScannedImport) => [f.type, f.url]), [
      ['js-import', './x.ts'],
      ['js-import', '/y.ts'],
      ['js-import', '../z.ts'],
    ]);
  });
});
