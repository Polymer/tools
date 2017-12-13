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

import {HtmlImportScanner} from '../../html/html-import-scanner';
import {ScannedImport} from '../../index';
import {PackageRelativeUrl, ResolvedUrl} from '../../model/url';
import {runScannerOnContents} from '../test-utils';

suite('HtmlImportScanner', () => {
  test('finds HTML Imports', async () => {
    const contents = `<html><head>
          <link rel="import" href="polymer.html">
          <link rel="import" type="css" href="polymer.css">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
    const {features} = await runScannerOnContents(
        new HtmlImportScanner(), 'test.html', contents);
    const importFeatures = features as ScannedImport[];
    assert.deepEqual(
        importFeatures.map((imp) => [imp.type, imp.url]),
        [['html-import', 'polymer.html']]);
  });

  test('resolves HTML Import URLs relative to baseUrl', async () => {
    const contents = `<html><head><base href="/aybabtu/">
          <link rel="import" href="polymer.html">
          <link rel="import" type="css" href="polymer.css">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
    const {features} = await runScannerOnContents(
        new HtmlImportScanner(), 'test.html', contents);
    const importFeatures = features as ScannedImport[];
    assert.deepEqual(
        importFeatures.map((imp) => [imp.type, imp.url]),
        [['html-import', '/aybabtu/polymer.html']]);
  });

  test('finds lazy HTML Imports', async () => {
    const contents = `<html><head>
          <link rel="import" href="polymer.html">
          <dom-module>
          <link rel="lazy-import"  href="lazy-polymer.html">
          </dom-module>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
    const {features} = await runScannerOnContents(
        new HtmlImportScanner(), 'test.html', contents);
    const importFeatures = features as ScannedImport[];
    assert.deepEqual(
        importFeatures.map((imp) => [imp.type, imp.url, imp.lazy]), [
          ['html-import', 'polymer.html', false],
          ['html-import', 'lazy-polymer.html', true]
        ]);
  });
});

suite('scan() with lazy import map', () => {
  test('injects synthetic lazy html imports', async () => {
    const contents = `<html><head>
          <link rel="import" href="polymer.html">
          <link rel="import" type="css" href="polymer.css">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
    const lazyEdges = new Map<ResolvedUrl, PackageRelativeUrl[]>([[
      'test.html' as ResolvedUrl,
      ['lazy1.html', 'lazy2.html', 'lazy3.html'] as PackageRelativeUrl[]
    ]]);

    const {features} = await runScannerOnContents(
        new HtmlImportScanner(lazyEdges), 'test.html', contents);
    const importFeatures = features as ScannedImport[];
    assert.deepEqual(
        importFeatures.map((f) => f.type),
        ['html-import', 'html-import', 'html-import', 'html-import']);
    assert.deepEqual(
        importFeatures.map((i) => i.lazy), [false, true, true, true]);
    assert.deepEqual(
        importFeatures.map((f) => f.url),
        ['polymer.html', 'lazy1.html', 'lazy2.html', 'lazy3.html']);
  });
});
