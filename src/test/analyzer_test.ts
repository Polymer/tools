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
import * as path from 'path';

import {Analyzer} from '../analyzer';
import {DocumentDescriptor, ImportDescriptor, InlineDocumentDescriptor} from '../ast/ast';
import {HtmlDocument} from '../html/html-document';
import {HtmlParser} from '../html/html-parser';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {Document} from '../parser/document';
import {PolymerElementDescriptor} from '../polymer/element-descriptor';
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

    test('returns a Promise that resolves to a DocumentDescriptor', async() => {
      const descriptor =
          await analyzer.analyze('/static/html-parse-target.html');
      // TODO(justinfagnani): add a lot more checks, especially for
      // transitive dependencies
    });

    test('resolves URLs', async() => {
      const docs = await Promise.all([
        analyzer.analyze('test.com/test.html'),
        analyzer.analyze('/static/html-parse-target.html'),
      ]);
      let doc1 = docs[0];
      let doc2 = docs[1];
      assert.equal(doc1.url, '/static/html-parse-target.html');
      assert.equal(doc1, doc2);
    });

    test('returns a Promise that rejects for malformed files', async() => {
      const error =
          await invertPromise(analyzer.analyze('static/malformed.html'));
      assert.include(error.message, 'malformed.html');
    });

    test('analyzes transitive dependencies', async() => {
      const root = await analyzer.analyze('static/dependencies/root.html');
      // check first level dependencies
      assert.deepEqual(
          root.dependencies.map((d: DocumentDescriptor) => d.url), [
            'static/dependencies/inline-only.html',
            'static/dependencies/leaf.html',
            'static/dependencies/inline-and-imports.html',
            'static/dependencies/subfolder/in-folder.html',
          ]);

      let inlineOnly = <DocumentDescriptor>root.dependencies[0];
      assert.deepEqual(
          inlineOnly.dependencies.map(
              (d: DocumentDescriptor) => d.document.type),
          ['js', 'css']);

      let leaf = <DocumentDescriptor>root.dependencies[1];
      assert.equal(leaf.dependencies.length, 0);

      let inlineAndImports = <DocumentDescriptor>root.dependencies[2];
      assert.deepEqual(
          inlineAndImports.dependencies.map(
              (d: DocumentDescriptor) => d.document.type),
          ['js', 'html', 'css']);

      let inFolder = <DocumentDescriptor>root.dependencies[3];
      assert.equal(inFolder.dependencies.length, 1);
      assert.equal(
          (<DocumentDescriptor>inFolder.dependencies[0]).url,
          'static/dependencies/subfolder/subfolder-sibling.html');

      // check de-duplication
      assert.equal(inlineAndImports.dependencies[1], leaf);
    });

    test('returns a Promise that rejects for malformed files', async() => {
      await invertPromise(analyzer.analyze('/static/malformed.html'));
    });

  });

  // TODO: reconsider whether we should test these private methods.
  suite('_load()', () => {

    test('loads and parses an HTML document', async() => {
      const doc = await analyzer['_load']('/static/html-parse-target.html');
      assert.instanceOf(doc, HtmlDocument);
      assert.equal(doc.url, '/static/html-parse-target.html');
    });

    test('loads and parses a JavaScript document', async() => {
      const doc = await analyzer['_load']('/static/js-elements.js');
      assert.instanceOf(doc, JavaScriptDocument);
      assert.equal(doc.url, '/static/js-elements.js');
    });

    test('resolves URLs', async() => {
      const docs = await Promise.all([
        analyzer['_load']('test.com/test.html'),
        analyzer['_load']('/static/html-parse-target.html'),
      ]);
      let doc1 = docs[0];
      let doc2 = docs[1];
      assert.equal(doc1.url, '/static/html-parse-target.html');
      assert.equal(doc1, doc2);
    });

    test('returns a Promise that rejects for non-existant files', async() => {
      await invertPromise(analyzer['_load']('/static/not-found'));
    });

  });

  suite('_getEntities()', () => {
    test('default import finders', async() => {
      let contents = `<html><head>
          <link rel="import" href="polymer.html">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
      const document = new HtmlParser().parse(contents, 'test.html');
      const entities =
          <ImportDescriptor<any>[]>(await analyzer['_getEntities'](document));
      assert.deepEqual(
          entities.map(e => e.type),
          ['html-import', 'html-script', 'html-style']);
      assert.deepEqual(
          entities.map(e => e.url),  //
          ['polymer.html', 'foo.js', 'foo.css']);
    });

    test('HTML inline document finders', async() => {
      let contents = `<html><head>
          <script>console.log('hi')</script>
          <style>body { color: red; }</style>
        </head></html>`;
      const document = new HtmlParser().parse(contents, 'test.html');
      const entities = <InlineDocumentDescriptor<any>[]>(
          await analyzer['_getEntities'](document));

      assert.equal(entities.length, 2);
      assert.instanceOf(entities[0], InlineDocumentDescriptor);
      assert.instanceOf(entities[1], InlineDocumentDescriptor);
    });

  });

  suite('legacy tests', () => {

    // ported from old js-parser_test.js
    test('parses classes', () => {
      return analyzer.analyze('static/es6-support.js').then((document) => {
        let elements = <PolymerElementDescriptor[]>document.entities.filter(
            (e) => e instanceof PolymerElementDescriptor);
        assert.equal(elements.length, 2);

        let element1 = elements[0];
        assert.equal(element1.behaviors.length, 2);
        assert.equal(element1.behaviors[0], 'Behavior1');
        assert.equal(element1.behaviors[1], 'Behavior2');
        assert.equal(element1.tagName, 'test-seed');

        assert.equal(element1.observers.length, 2);
        assert.equal(element1.properties.length, 4);

        // TODO(justinfagnani): fix events
        // assert.equal(elements[0].events.length, 1);
        assert.equal(elements[1].tagName, 'test-element');
      });
    });

    // ported from old js-parser_test.js
    test('parses events from classes', () => {
      return analyzer.analyze('static/es6-support.js').then((document) => {
        let elements = <PolymerElementDescriptor[]>document.entities.filter(
            (e) => e instanceof PolymerElementDescriptor);
        assert.deepEqual(
            elements.map(e => e.tagName), ['test-seed', 'test-element']);
        assert.deepEqual(
            elements[0].events.map(e => e.name),
            ['fired-event', 'data-changed']);
      });
    });

  });

});
