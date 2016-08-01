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
import * as parse5 from 'parse5';
import * as path from 'path';

import {Analyzer} from '../analyzer';
import {DocumentDescriptor, ElementDescriptor, ImportDescriptor, InlineDocumentDescriptor} from '../ast/ast';
import {HtmlDocument} from '../html/html-document';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {Document} from '../parser/document';
import {FSUrlLoader} from '../url-loader/fs-url-loader';

import {invertPromise} from './test-utils';

suite('Analyzer', () => {
  let analyzer: Analyzer;

  setup(() => {
    analyzer = new Analyzer({
      urlLoader: new FSUrlLoader(__dirname),
    });
  });

  suite('load()', () => {

    test('loads and parses an HTML document', async() => {
      const doc = await analyzer.load('/static/html-parse-target.html');
      assert.instanceOf(doc, HtmlDocument);
      assert.equal(doc.url, '/static/html-parse-target.html');
    });

    test('loads and parses a JavaScript document', async() => {
      const doc = await analyzer.load('/static/js-elements.js');
      assert.instanceOf(doc, JavaScriptDocument);
      assert.equal(doc.url, '/static/js-elements.js');
    });

    test('returns a Promise that rejects for non-existant files', async() => {
      await invertPromise(analyzer.load('/static/not-found'));
    });

  });

  suite('analyze()', () => {

    test('returns a Promise that resolves to a DocumentDescriptor', async() => {
      const descriptor =
          await analyzer.analyze('/static/html-parse-target.html');
      // TODO(justinfagnani): add a lot more checks, especially for
      // transitive dependencies
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

  suite('getEntities()', () => {
    test('default import finders', async() => {
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
      const entities =
          <ImportDescriptor<any>[]>(await analyzer.getEntities(document));
      assert.equal(entities.length, 3);
      assert.equal(entities[0].type, 'html-import');
      assert.equal(entities[0].url, 'polymer.html');
      assert.equal(entities[1].type, 'html-script');
      assert.equal(entities[1].url, 'foo.js');
      assert.equal(entities[2].type, 'html-style');
      assert.equal(entities[2].url, 'foo.css');
    });

    test('HTML inline document finders', async() => {
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
      const entities = <InlineDocumentDescriptor<any>[]>(
          await analyzer.getEntities(document));

      assert.equal(entities.length, 2);
      assert.instanceOf(entities[0], InlineDocumentDescriptor);
      assert.instanceOf(entities[1], InlineDocumentDescriptor);
    });

  });

  suite('legacy tests', () => {

    // ported from old js-parser_test.js
    test('parses classes', () => {
      return analyzer.analyze('static/es6-support.js').then((document) => {
        let elements = <ElementDescriptor[]>document.entities.filter(
            (e) => e['type'] === 'element');
        assert.equal(elements.length, 2);

        let element1 = elements[0];
        assert.equal(element1.behaviors.length, 2);
        assert.equal(element1.behaviors[0], 'Behavior1');
        assert.equal(element1.behaviors[1], 'Behavior2');
        assert.equal(element1.is, 'test-seed');

        assert.equal(element1.observers.length, 2);
        assert.equal(element1.properties.length, 4);

        // TODO(justinfagnani): fix events
        // assert.equal(elements[0].events.length, 1);
        assert.equal(elements[1].is, 'test-element');
      });
    });

    // ported from old js-parser_test.js
    test('parses events from classes', () => {
      return analyzer.analyze('static/es6-support.js').then((document) => {
        let elements = <ElementDescriptor[]>document.entities.filter(
            (e) => e['type'] === 'element');
        assert.equal(elements.length, 2);

        let element1 = elements[0];
        assert.equal(element1.events.length, 1);
      });
    });

  });

});
