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

/// <reference path="../../node_modules/@types/mocha/index.d.ts" />

import {assert} from 'chai';

import {Analyzer} from '../analyzer';
import {ParsedHtmlDocument} from '../html/html-document';
import {HtmlParser} from '../html/html-parser';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {InlineParsedDocument, ScannedImport} from '../model/model';
import {FSUrlLoader} from '../url-loader/fs-url-loader';
import {UrlResolver} from '../url-loader/url-resolver';

import {invertPromise} from './test-utils';

class TestUrlResolver implements UrlResolver {
  canResolve(url: string) {
    return (url === 'test.com/test.html');
  }

  resolve(url: string) {
    return (url === 'test.com/test.html') ? '/static/html-parse-target.html' :
                                            url;
  }
}

suite('Analyzer', () => {
  let analyzer: Analyzer;

  setup(() => {
    analyzer = new Analyzer({
      urlLoader: new FSUrlLoader(__dirname),
      urlResolver: new TestUrlResolver(),
    });
  });


  suite('analyze()', () => {

    test('returns a Document with warnings for malformed files', async() => {
      const document = await analyzer.analyzeRoot('static/malformed.html');
      assert(document.getWarnings().length >= 1);
    });

    test('analyzes transitive dependencies', async() => {
      const root = await analyzer.analyzeRoot('static/dependencies/root.html');

      // If we ask for documents we get every document in evaluation order.
      assert.deepEqual(
          Array.from(root.getByKind('document'))
              .map((d) => [d.url, d.parsedDocument.type, d.isInline]),
          [
            ['static/dependencies/root.html', 'html', false],
            ['static/dependencies/inline-only.html', 'html', false],
            ['static/dependencies/inline-only.html', 'js', true],
            ['static/dependencies/inline-only.html', 'css', true],
            ['static/dependencies/leaf.html', 'html', false],
            ['static/dependencies/inline-and-imports.html', 'html', false],
            ['static/dependencies/inline-and-imports.html', 'js', true],
            ['static/dependencies/subfolder/in-folder.html', 'html', false],
            [
              'static/dependencies/subfolder/subfolder-sibling.html', 'html',
              false
            ],
            ['static/dependencies/inline-and-imports.html', 'css', true],
          ]);

      // If we ask for imports we get the import statements in evaluation order.
      // Unlike documents, we can have duplicates here because imports exist
      // in distinct places in their containing docs.
      assert.deepEqual(Array.from(root.getByKind('import')).map((d) => d.url), [
        'static/dependencies/inline-only.html',
        'static/dependencies/leaf.html',
        'static/dependencies/inline-and-imports.html',
        'static/dependencies/subfolder/in-folder.html',
        'static/dependencies/subfolder/subfolder-sibling.html',
        'static/dependencies/subfolder/in-folder.html',
      ]);

      const inlineOnly =
          root.getOnlyAtId('document', 'static/dependencies/inline-only.html');
      assert.deepEqual(
          Array.from(inlineOnly.getByKind('document'))
              .map((d) => d.parsedDocument.type),
          ['html', 'js', 'css']);

      const leaf =
          root.getOnlyAtId('document', 'static/dependencies/leaf.html');
      assert.deepEqual(Array.from(leaf.getByKind('document')), [leaf]);

      const inlineAndImports = root.getOnlyAtId(
          'document', 'static/dependencies/inline-and-imports.html');
      assert.deepEqual(
          Array.from(inlineAndImports.getByKind('document'))
              .map((d) => d.parsedDocument.type),
          ['html', 'js', 'html', 'html', 'css']);
      const inFolder = root.getOnlyAtId(
          'document', 'static/dependencies/subfolder/in-folder.html');
      assert.deepEqual(
          Array.from(inFolder.getByKind('document')).map(d => d.url), [
            'static/dependencies/subfolder/in-folder.html',
            'static/dependencies/subfolder/subfolder-sibling.html'
          ]);

      // check de-duplication
      assert.equal(
          inlineAndImports.getOnlyAtId(
              'document', 'static/dependencies/subfolder/in-folder.html'),
          inFolder);
    });

    test(`rejects for files that don't exist`, async() => {
      await invertPromise(analyzer.analyzeRoot('/static/does_not_exist'));
    });

  });

  // TODO: reconsider whether we should test these private methods.
  suite('_parse()', () => {

    test('loads and parses an HTML document', async() => {
      const doc = await analyzer['_parse']('static/html-parse-target.html');
      assert.instanceOf(doc, ParsedHtmlDocument);
      assert.equal(doc.url, 'static/html-parse-target.html');
    });

    test('loads and parses a JavaScript document', async() => {
      const doc = await analyzer['_parse']('static/js-elements.js');
      assert.instanceOf(doc, JavaScriptDocument);
      assert.equal(doc.url, 'static/js-elements.js');
    });

    test('returns a Promise that rejects for non-existant files', async() => {
      await invertPromise(analyzer['_parse']('static/not-found'));
    });

  });

  suite('_getScannedFeatures()', () => {
    test('default import scanners', async() => {
      let contents = `<html><head>
          <link rel="import" href="polymer.html">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
      const document = new HtmlParser().parse(contents, 'test.html');
      const features =
          <ScannedImport[]>(await analyzer['_getScannedFeatures'](document));
      assert.deepEqual(
          features.map(e => e.type),
          ['html-import', 'html-script', 'html-style']);
      assert.deepEqual(
          features.map(e => e.url),  //
          ['polymer.html', 'foo.js', 'foo.css']);
    });

    test('polymer css import scanner', async() => {
      let contents = `<html><head>
          <link rel="import" type="css" href="foo.css">
        </head>
        <body>
          <dom-module>
            <link rel="import" type="css" href="bar.css">
          </dom-module>
        </body></html>`;
      const document = new HtmlParser().parse(contents, 'test.html');
      const features =
          <ScannedImport[]>(await analyzer['_getScannedFeatures'](document))
              .filter(e => e instanceof ScannedImport);
      assert.equal(features.length, 1);
      assert.equal(features[0].type, 'css-import');
      assert.equal(features[0].url, 'bar.css');
    });

    test('HTML inline document scanners', async() => {
      let contents = `<html><head>
          <script>console.log('hi')</script>
          <style>body { color: red; }</style>
        </head></html>`;
      const document = new HtmlParser().parse(contents, 'test.html');
      const features = <InlineParsedDocument[]>(
          await analyzer['_getScannedFeatures'](document));

      assert.equal(features.length, 2);
      assert.instanceOf(features[0], InlineParsedDocument);
      assert.instanceOf(features[1], InlineParsedDocument);
    });

  });

  suite('legacy tests', () => {

    // ported from old js-parser_test.js
    // FIXME(rictic): I've temporarily disabled most recognition of Polymer ES6
    //     classes because the scanner is buggy and triggers when it shouldn't.
    test.skip('parses classes', async() => {
      const document = await analyzer.analyzeRoot('static/es6-support.js');

      const elements = Array.from(document.getByKind('polymer-element'));
      assert.deepEqual(
          elements.map(e => e.tagName), ['test-seed', 'test-element']);
      const testSeed = elements[0];

      assert.deepEqual(testSeed.behaviors, ['Behavior1', 'Behavior2']);
      assert.equal(testSeed.tagName, 'test-seed');

      assert.equal(testSeed.observers.length, 2);
      assert.equal(testSeed.properties.length, 4);

      assert.deepEqual(
          testSeed.events.map(e => e.name), ['fired-event', 'data-changed']);
    });
  });
});
