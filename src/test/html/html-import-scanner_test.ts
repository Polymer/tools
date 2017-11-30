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

import {HtmlVisitor} from '../../html/html-document';
import {HtmlImportScanner} from '../../html/html-import-scanner';
import {HtmlParser} from '../../html/html-parser';
import {PackageRelativeUrl, ResolvedUrl} from '../../model/url';

suite('HtmlImportScanner', () => {
  suite('scan()', () => {
    let scanner: HtmlImportScanner;

    setup(() => {
      scanner = new HtmlImportScanner();
    });

    test('finds HTML Imports', async () => {
      const contents = `<html><head>
          <link rel="import" href="polymer.html">
          <link rel="import" type="css" href="polymer.css">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);

      const {features} = await scanner.scan(document, visit);
      assert.equal(features.length, 1);
      assert.equal(features[0].type, 'html-import');
      assert.equal(features[0].url, 'polymer.html');
    });

    test('resolves HTML Import URLs relative to baseUrl', async () => {
      const contents = `<html><head><base href="/aybabtu/">
          <link rel="import" href="polymer.html">
          <link rel="import" type="css" href="polymer.css">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);

      const {features} = await scanner.scan(document, visit);
      assert.equal(features.length, 1);
      assert.equal(features[0].type, 'html-import');
      assert.equal(features[0].url, '/aybabtu/polymer.html');
    });

    test('finds lazy HTML Imports', async () => {
      const contents = `<html><head>
          <link rel="import" href="polymer.html">
          <dom-module>
          <link rel="lazy-import"  href="lazy-polymer.html">
          </dom-module>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);

      const {features} = await scanner.scan(document, visit);
      assert.equal(features.length, 2);
      assert.equal(features[1].type, 'html-import');
      assert.equal(features[1].url, 'lazy-polymer.html');
      assert.equal(features[1].lazy, true);
    });
  });

  suite('scan() with lazy import map', () => {
    let scanner: HtmlImportScanner;

    setup(() => {
      const lazyEdges = new Map<ResolvedUrl, PackageRelativeUrl[]>();
      lazyEdges.set(
          'test.html' as ResolvedUrl,
          ['lazy1.html', 'lazy2.html', 'lazy3.html'] as PackageRelativeUrl[]);
      scanner = new HtmlImportScanner(lazyEdges);
    });

    test('injects synthetic lazy html imports', async () => {
      const contents = `<html><head>
          <link rel="import" href="polymer.html">
          <link rel="import" type="css" href="polymer.css">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);

      const {features} = await scanner.scan(document, visit);
      assert.deepEqual(
          features.map((f) => f.type),
          ['html-import', 'html-import', 'html-import', 'html-import']);
      assert.deepEqual(features.map((i) => i.lazy), [false, true, true, true]);
      assert.deepEqual(
          features.map((f) => f.url),
          ['polymer.html', 'lazy1.html', 'lazy2.html', 'lazy3.html']);
    });
  });
});
