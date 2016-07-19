/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

"use strict";

const assert = require('chai').assert;
const parse5 = require('parse5');
const path = require('path');

const Analyzer = require('../lib/analyzer').Analyzer;
const FSUrlLoader = require('../lib/url-loader/fs-url-loader').FSUrlLoader;
const AnalyzedDocument = require('../lib/analyzed-document').AnalyzedDocument;
const Document = require('../lib/parser/document').Document;
const HtmlDocument = require('../lib/parser/html-document').HtmlDocument;
const JavaScriptDocument = require('../lib/parser/javascript-document').JavaScriptDocument;

suite('Analyzer', () => {
  let importFinder;
  let analyzer;

  setup(() => {
    analyzer = new Analyzer({
      urlLoader: new FSUrlLoader(__dirname),
    });
  });

  suite('load()', () => {

    test('loads and parses an HTML document', () => {
      return analyzer.load('/static/html-parse-target.html')
        .then((doc) => {
          assert.instanceOf(doc, HtmlDocument);
          assert.equal(doc.url, '/static/html-parse-target.html');
        });
    });

    test('loads and parses a JavaScript document', () => {
      return analyzer.load('/static/js-elements.js')
        .then((doc) => {
          assert.instanceOf(doc, JavaScriptDocument);
          assert.equal(doc.url, '/static/js-elements.js');
        });
    });

    test('returns a Promise that rejects for non-existant files', () => {
      return analyzer.load('/static/not-found')
        .then((doc) => {
          assert.fail();
        }, (error) => {
          // pass
        });
    });

    test.skip('returns a Promise that rejects for malformed files', () => {
      return analyzer.load('/static/malformed.html')
        .then((doc) => {
          assert.fail();
        }, (error) => {
          // pass
        });
    });

  });

  suite('analyze()', () => {

    test('returns a Promise that resolves to a DocumentDescriptor', () => {
      return analyzer.analyze('/static/html-parse-target.html')
        .then((descriptor) => {
          // TODO(justinfagnani): add a lot more checks, especially for
          // transitive dependencies
        });
    });

    test('returns a Promise that rejects for malformed files', () => {
      return analyzer.analyze('static/malformed.html')
        .then((root) => {
          assert.fail();
        }, (error) => {
          assert.include(error.message, 'malformed.html');
        });
    });

  });

  suite('findImports()', () => {

    test('calls to the ImportFinders', () => {
      importFinder = new ImportFinderStub([{
        type: 'html',
        url: 'abc',
      }]);
      let analyzer = new Analyzer({
        urlLoader: new FSUrlLoader(__dirname),
        importFinders: new Map([['html', [importFinder]]]),
      });
      let document = {};
      let imports = analyzer.findImports('foo.html', document);
      assert.equal(importFinder.calls.length, 1);
      assert.equal(importFinder.calls[0].url, 'foo.html');
      assert.equal(importFinder.calls[0].document, document);
      assert.equal(imports.length, 1);
      assert.equal(imports[0].url, 'abc');
      assert.equal(imports[0].type, 'html');
    });

    test('default import finders', () => {
      let document = parse5.parse(`<html><head>
          <link rel="import" href="polymer.html">
          <script src="foo.js"></script>
          <script>console.log('hi')</script>
        </head></html>`);
      let imports = analyzer.findImports('foo.html', document);
      assert.equal(imports.length, 2);
      assert.equal(imports[0].type, 'html-import');
      assert.equal(imports[0].url, 'polymer.html');
      assert.equal(imports[1].type, 'html-script');
      assert.equal(imports[1].url, 'foo.js');
    });

  });

});

class ImportFinderStub {

  constructor(imports) {
    this.imports = imports;
    this.calls = [];
  }

  findImports(url, document) {
    this.calls.push({url, document});
    return this.imports;
  }

}
