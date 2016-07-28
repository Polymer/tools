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

"use strict";

const assert = require('chai').assert;
const parse5 = require('parse5');
const path = require('path');

const invertPromise = require('./test-utils').invertPromise;
const Analyzer = require('../lib/analyzer').Analyzer;
const DocumentDescriptor = require('../lib/ast/ast').DocumentDescriptor;
const InlineDocumentDescriptor = require('../lib/ast/ast').InlineDocumentDescriptor;
const FSUrlLoader = require('../lib/url-loader/fs-url-loader').FSUrlLoader;
const Document = require('../lib/parser/document').Document;
const HtmlDocument = require('../lib/html/html-document').HtmlDocument;
const JavaScriptDocument =
    require('../lib/javascript/javascript-document').JavaScriptDocument;
const ImportDescriptor =
    require('../lib/ast/import-descriptor').ImportDescriptor;

suite('Analyzer', () => {
  let analyzer;

  setup(() => {
    analyzer = new Analyzer({
      urlLoader: new FSUrlLoader(__dirname),
    });
  });

  suite('load()', () => {

    test('loads and parses an HTML document', () => {
      return analyzer.load('/static/html-parse-target.html').then((doc) => {
        assert.instanceOf(doc, HtmlDocument);
        assert.equal(doc.url, '/static/html-parse-target.html');
      });
    });

    test('loads and parses a JavaScript document', () => {
      return analyzer.load('/static/js-elements.js').then((doc) => {
        assert.instanceOf(doc, JavaScriptDocument);
        assert.equal(doc.url, '/static/js-elements.js');
      });
    });

    test('returns a Promise that rejects for non-existant files', () => {
      return invertPromise(analyzer.load('/static/not-found'));
    });

    test.skip('returns a Promise that rejects for malformed files', () => {
      return invertPromise(analyzer.load('/static/malformed.html'));
    });

  });

  suite('analyze()', () => {

    test('returns a Promise that resolves to a DocumentDescriptor', () => {
      return analyzer.analyze('/static/html-parse-target.html')
          .then(
              (descriptor) => {
                  // TODO(justinfagnani): add a lot more checks, especially for
                  // transitive dependencies
              });
    });

    test('returns a Promise that rejects for malformed files', () => {
      return invertPromise(analyzer.analyze('static/malformed.html'))
          .then((error) => {
            assert.include(error.message, 'malformed.html');
          });
    });

    test('analyzes transitive dependencies', () => {
      return analyzer.analyze('static/dependencies/root.html')
        .then((root) => {
          // check first level dependencies
          assert.deepEqual(
            root.dependencies.map((d) => d.url),
            [
              'static/dependencies/inline-only.html',
              'static/dependencies/leaf.html',
              'static/dependencies/inline-and-imports.html',
              'static/dependencies/subfolder/in-folder.html',
            ]
          );

          let inlineOnly = root.dependencies[0];
          assert.deepEqual(
            inlineOnly.dependencies.map((d) => d.document.type),
            ['js', 'css']
          );

          let leaf = root.dependencies[1];
          assert.equal(leaf.dependencies.length, 0);

          let inlineAndImports = root.dependencies[2];
          assert.deepEqual(
            inlineAndImports.dependencies.map((d) => d.document.type),
            ['js', 'html', 'css']
          );

          let inFolder = root.dependencies[3];
          assert.equal(inFolder.dependencies.length, 1);
          assert.equal(inFolder.dependencies[0].url,
            'static/dependencies/subfolder/subfolder-sibling.html');

          // check de-duplication
          assert.equal(inlineAndImports.dependencies[1], leaf);
        });
    });


  });

  suite('getEntities()', () => {
    test('default import finders', () => {
      let contents = `<html><head>
          <link rel="import" href="polymer.html">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
      let ast = parse5.parse(contents);
      let document = new HtmlDocument({
        url: 'test.html',
        contents,
        ast,
      });
      return analyzer.getEntities(document).then((entities) => {
        assert.equal(entities.length, 3);
        assert.equal(entities[0].type, 'html-import');
        assert.equal(entities[0].url, 'polymer.html');
        assert.equal(entities[1].type, 'html-script');
        assert.equal(entities[1].url, 'foo.js');
        assert.equal(entities[2].type, 'html-style');
        assert.equal(entities[2].url, 'foo.css');
      });
    });

    test('HTML inline document finders', () => {
      let contents = `<html><head>
          <script>console.log('hi')</script>
          <style>body { color: red; }</style>
        </head></html>`;
      let ast = parse5.parse(contents);
      let document = new HtmlDocument({
        url: 'test.html',
        contents,
        ast,
      });
      return analyzer.getEntities(document).then((entities) => {
        assert.equal(entities.length, 2);
        assert.instanceOf(entities[0], InlineDocumentDescriptor);
        assert.instanceOf(entities[1], InlineDocumentDescriptor);
      });

    });

  });

});
