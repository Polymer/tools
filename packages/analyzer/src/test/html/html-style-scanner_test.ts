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

import {HtmlStyleScanner} from '../../html/html-style-scanner';
import {FileRelativeUrl, ScannedImport, ScannedInlineDocument} from '../../model/model';
import {runScannerOnContents} from '../test-utils';

suite('HtmlStyleScanner', () => {
  test('finds external and inline styles', async () => {
    const contents = `<html><head>
          <link rel="stylesheet" type="text/css" href="foo.css">
          <style>h1 { color: green; }</style>
        </head></html>`;

    const {features} = await runScannerOnContents(
        new HtmlStyleScanner(), 'test-document.html', contents);
    assert.equal(features.length, 2);
    assert.instanceOf(features[0], ScannedImport);
    const feature0 = <ScannedImport>features[0];
    assert.equal(feature0.type, 'html-style');
    assert.equal(feature0.url, 'foo.css' as FileRelativeUrl);
    assert.instanceOf(features[1], ScannedInlineDocument);
    const feature1 = <ScannedInlineDocument>features[1];
    assert.equal(feature1.type, 'css');
    assert.equal(feature1.contents, `h1 { color: green; }`);
    assert.deepEqual(feature1.locationOffset, {line: 2, col: 17});
  });

  test('finds external styles relative to baseUrl', async () => {
    const contents = `<html><head><base href="/aybabtu/">
          <link rel="stylesheet" type="text/css" href="foo.css">
        </head></html>`;

    const {features} = await runScannerOnContents(
        new HtmlStyleScanner(), 'test-document.html', contents);
    assert.deepEqual(
        features.map((f: ScannedImport) => [f.type, f.url]),
        [['html-style', 'foo.css']]);
  });
});
