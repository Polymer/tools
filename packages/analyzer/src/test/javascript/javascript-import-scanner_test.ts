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
import {createForDirectory, fixtureDir, runScanner} from '../test-utils';

suite('JavaScriptImportScanner', () => {
  let analyzer: Analyzer;
  before(async () => {
    ({analyzer} = await createForDirectory(fixtureDir));
  });

  test('finds imports', async () => {
    const {features, warnings} = await runScanner(
        analyzer, new JavaScriptImportScanner(), 'javascript/module.js');
    assert.equal(warnings.length, 0);
    assert.containSubset(features, [
      {
        type: 'js-import',
        url: './submodule.js',
        lazy: false,
      },
    ]);
  });

  test('finds dynamic imports', async () => {
    const {features, warnings} = await runScanner(
        analyzer,
        new JavaScriptImportScanner({moduleResolution: 'node'}),
        'javascript/dynamic-import.js');

    assert.equal(warnings.length, 1);
    assert.containSubset(warnings, [{code: 'non-literal-import'}]);
    assert.containSubset(features, [
      {
        type: 'js-import',
        url: './submodule.js',
        lazy: true,
        specifier: './submodule.js',
      },
      {
        type: 'js-import',
        url: './node_modules/test-package/index.js',
        lazy: true,
        specifier: 'test-package'
      },
    ]);
  });

  test('resolves bare specifiers', async () => {
    const {features, warnings} = await runScanner(
        analyzer,
        new JavaScriptImportScanner({moduleResolution: 'node'}),
        'javascript/module-with-named-import.js');

    assert.equal(warnings.length, 0);
    assert.containSubset(features, [
      {
        type: 'js-import',
        url: './node_modules/test-package/index.js',
        lazy: false,
        specifier: 'test-package'
      },
      {
        type: 'js-import',
        url: './node_modules/test-package/index.js',
        lazy: false,
        specifier: 'test-package'
      },
    ]);
  });

  test('warns for non-resolvable bare specifiers', async () => {
    const {features, warnings} = await runScanner(
        analyzer,
        new JavaScriptImportScanner({moduleResolution: 'node'}),
        'javascript/module-with-not-found-named-import.js');

    assert.equal(warnings.length, 1);
    assert.containSubset(warnings, [{code: 'cant-resolve-module-specifier'}]);
    assert.containSubset(features, [
      {
        type: 'js-import',
        url: undefined,
        lazy: false,
      },
    ]);
  });

  test('handles URL specifiers', async () => {
    const {features, warnings} = await runScanner(
        analyzer,
        new JavaScriptImportScanner(),
        'javascript/module-with-remote-import.js');

    assert.equal(warnings.length, 0);
    assert.containSubset(features, [
      {
        type: 'js-import',
        url: 'https://unpkg.com/lit-html/lit-html.js',
        lazy: false,
      },
    ]);
  });

  test('recognizes reexports as imports', async () => {
    const {features, warnings} = await runScanner(
        analyzer,
        new JavaScriptImportScanner(),
        'javascript/all-export-types.js');

    assert.equal(warnings.length, 0);
    assert.containSubset(features, [
      {
        type: 'js-import',
        url: './module-with-export.js',
        lazy: false,
      },
      {
        type: 'js-import',
        url: './module-with-export.js',
        lazy: false,
      },
    ]);
  });
});
