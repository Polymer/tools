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

import {ScannedImport} from '../../index';
import {CssImportScanner} from '../../polymer/css-import-scanner';
import {runScannerOnContents} from '../test-utils';

suite('CssImportScanner', () => {
  test('finds CSS Imports', async () => {
    const contents = `<html><head>
          <link rel="import" href="polymer.html">
          <link rel="import" type="css" href="ignored-outside-dom-module.css">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head>
        <body>
          <dom-module>
            <link rel="import" type="css" href="polymer.css">
            <template>
              <link rel="import" type="css" href="ignored-in-template.css">
            </template>
          </dom-module>
        </body>
        </html>`;
    const {features} = await runScannerOnContents(
        new CssImportScanner(), 'test.html', contents);
    assert.deepEqual(
        features.map((f: ScannedImport) => [f.type, f.url]),
        [['css-import', 'polymer.css']]);
  });

  test('adjusts CSS Import urls relative to baseUrl', async () => {
    const contents = `<html><head><base href="/aybabtu/">
        </head>
        <body>
          <dom-module>
            <link rel="import" type="css" href="polymer.css">
          </dom-module>
        </body>
        </html>`;
    const {features, analyzer, urlLoader} = await runScannerOnContents(
        new CssImportScanner(), 'test.html', contents);
    assert.deepEqual(
        features.map((f: ScannedImport) => [f.type, f.url]),
        [['css-import', 'polymer.css']]);

    urlLoader.urlContentsMap.set(
        analyzer.resolveUrl('aybabtu/polymer.css')!, '');
    const [import_] =
        (await analyzer.analyze(['test.html'])).getFeatures({kind: 'import'});
    assert.equal(import_.originalUrl, 'polymer.css');
    assert.equal(import_.url, analyzer.resolveUrl('aybabtu/polymer.css'));
  });
});
