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


import {assert} from 'chai';

import {Analyzer} from '../../core/analyzer';
import {JavaScriptImportScanner} from '../../javascript/javascript-import-scanner';
import {fixtureDir, runScanner} from '../test-utils';

suite('JavaScriptImportScanner', () => {
  const analyzer = Analyzer.createForDirectory(fixtureDir);

  test('finds imports', async () => {
    const {features} = await runScanner(
        analyzer, new JavaScriptImportScanner(), 'javascript/module.js');
    assert.containSubset(features, [
      {
        type: 'js-import',
        url: './submodule.js',
        lazy: false,
      },
    ]);
  });

  test('finds dynamic imports', async () => {
    const {features} = await runScanner(
        analyzer,
        new JavaScriptImportScanner(),
        'javascript/dynamic-import.js');

    assert.containSubset(features, [
      {
        type: 'js-import',
        url: './submodule.js',
        lazy: true,
      },
    ]);
  });

  test('skips non-path imports', async () => {
    const {features} = await runScanner(
        analyzer,
        new JavaScriptImportScanner(),
        'javascript/module-with-named-import.js');

    assert.equal(features.length, 0);
  });
});
