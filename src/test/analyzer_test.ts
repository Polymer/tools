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
import * as clone from 'clone';
import * as shady from 'shady-css-parser';

import stripIndent = require('strip-indent');
import * as estree from 'estree';

import {Analyzer} from '../analyzer';
import {ParsedHtmlDocument} from '../html/html-document';
import {HtmlParser} from '../html/html-parser';
import {ScriptTagImport} from '../html/html-script-tag';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {ParsedCssDocument} from '../css/css-document';
import {Document, ScannedImport, ScannedInlineDocument} from '../model/model';
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

    test(
        'analyzes a document with an inline Polymer element feature',
        async() => {
          const document = await analyzer.analyze(
              'static/analysis/simple/simple-element.html');
          const elements = Array.from(document.getByKind('element'));
          assert.deepEqual(elements.map(e => e.tagName), ['simple-element']);
        });

    test(
        'analyzes a document with an external Polymer element feature',
        async() => {
          const document = await analyzer.analyze(
              'static/analysis/separate-js/element.html');
          const elements = Array.from(document.getByKind('element'));
          assert.deepEqual(elements.map(e => e.tagName), ['my-element']);
        });

    test('analyzes a document with an import', async() => {
      const document =
          await analyzer.analyze('static/analysis/behaviors/behavior.html');

      const behaviors = Array.from(document.getByKind('behavior'));
      assert.deepEqual(
          behaviors.map(b => b.className),
          ['MyNamespace.SubBehavior', 'MyNamespace.SimpleBehavior']);
    });

    test(
        'creates a document warning when a behavior cannot be found in that document',
        async() => {
          let document =
              await analyzer.analyze('static/html-missing-behaviors.html');
          // TODO(#372): this should be false, we should treat inline documents
          //     as not requiring `deep` to be true.
          let warnings = document.getWarnings(true);
          assert.deepEqual(warnings, [
            {
              message:
                  'Unable to resolve behavior `Polymer.ExpectedMissingBehavior`. ' +
                  'Did you import it? Is it annotated with @polymerBehavior?',
              severity: 0,
              code: 'unknown-polymer-behavior',
              sourceRange: {
                file: 'static/html-missing-behaviors.html',
                start: {
                  line: 23,
                  column: 8,
                },
                end: {
                  line: 23,
                  column: 39,
                }
              }
            }
          ]);
        });

    test(
        'creates "missing behavior" warnings on imported documents without elements',
        async() => {
          let document = await analyzer.analyze(
              'static/chained-missing-behavior/index.html');
          let chainedDocument = document.getOnlyAtId(
              'document', 'static/chained-missing-behavior/chained.html')!;
          let expectedWarning = {
            code: 'unknown-polymer-behavior',
            message:
                'Unable to resolve behavior `NotFoundBehavior`. Did you import it? Is it annotated with @polymerBehavior?',
            severity: 0,
            sourceRange: {
              end: {column: 55, line: 2},
              start: {column: 39, line: 2},
              file: 'static/chained-missing-behavior/chained.html'
            },
          };
          assert.deepEqual(document.getWarnings(false), []);
          assert.deepEqual(document.getWarnings(true), [expectedWarning]);
          // TODO(#372): this should be false, we should treat inline documents
          //     as not requiring `deep` to be true.
          assert.deepEqual(
              chainedDocument.getWarnings(true), [expectedWarning]);
        });

    test(
        'an inline document can find features from its container document',
        async() => {
          const document =
              await analyzer.analyze('static/analysis/behaviors/behavior.html');

          // TODO(justinfagnani): make a shallow option and check that this only
          // has
          // itself and an inline document, but not the sub-document. For now
          // check
          // that this fixture has 4 documents: behavior.html, subbehavior.html,
          // and their inline js documents
          const documents = document.getByKind('document');
          assert.equal(documents.size, 4);

          const inlineDocuments =
              Array.from(document.getFeatures(false))
                  .filter(
                      (d) => d instanceof Document && d.isInline) as Document[];
          assert.equal(inlineDocuments.length, 1);

          // This is the main purpose of the test: get a feature from the inline
          // document that's imported by the container document
          const behaviorJsDocument = inlineDocuments[0];
          const subBehavior = behaviorJsDocument.getOnlyAtId(
              'behavior', 'MyNamespace.SubBehavior');
          assert.equal(subBehavior!.className, 'MyNamespace.SubBehavior');
        });

    test(
        'an inline script can find features from its container document',
        async() => {
          const document = await analyzer.analyze(
              'static/script-tags/inline/test-element.html');
          // TODO(justinfagnani): this could be better with a shallow
          // Document.getByKind()
          const inlineDocuments =
              Array.from(document.getFeatures(false))
                  .filter(
                      (d) => d instanceof Document && d.isInline) as Document[];
          assert.equal(inlineDocuments.length, 1);
          const inlineJsDocument = inlineDocuments[0];

          // The inline document can find the container's imported features
          const subBehavior =
              inlineJsDocument.getOnlyAtId('behavior', 'TestBehavior');
          assert.equal(subBehavior!.className, 'TestBehavior');
        });

    test(
        'an external script can find features from its container document',
        async() => {
          const document = await analyzer.analyze(
              'static/script-tags/external/test-element.html');

          const htmlScriptTags = Array.from(document.getByKind('html-script'));
          assert.equal(htmlScriptTags.length, 1);

          const htmlScriptTag = htmlScriptTags[0] as ScriptTagImport;
          const scriptDocument = htmlScriptTag.document;

          // The inline document can find the container's imported features
          const subBehavior =
              scriptDocument.getOnlyAtId('behavior', 'TestBehavior');
          assert.equal(subBehavior!.className, 'TestBehavior');
        });


    // This test is nearly identical to the previous, but covers a different
    // issue.
    // PolymerElement must find behaviors while resolving, and if inline
    // documents don't add a document feature for their container until after
    // resolution, then the element can't find them and throws.
    test(
        'an inline document can find features from its container document',
        async() => {
          const document = await analyzer.analyze(
              'static/analysis/behaviors/elementdir/element.html');

          // TODO(justinfagnani): make a shallow option and check that this only
          // has
          // itself and an inline document, but not the sub-document. For now
          // check
          // that this fixture has 6 documents: element.html, behavior.html,
          // subbehavior.html, and their inline js documents
          const documents = document.getByKind('document');
          assert.equal(documents.size, 6);

          const inlineDocuments =
              Array.from(document.getFeatures(false))
                  .filter(
                      (d) => d instanceof Document && d.isInline) as Document[];
          assert.equal(inlineDocuments.length, 1);

          // This is the main purpose of the test: get a feature from the inline
          // document that's imported by the container document
          const behaviorJsDocument = inlineDocuments[0];
          const subBehavior = behaviorJsDocument.getOnlyAtId(
              'behavior', 'MyNamespace.SubBehavior');
          assert.equal(subBehavior!.className, 'MyNamespace.SubBehavior');
        });

    test('returns a Document with warnings for malformed files', async() => {
      const document = await analyzer.analyze('static/malformed.html');
      assert(document.getWarnings().length >= 1);
    });

    test('analyzes transitive dependencies', async() => {
      const root = await analyzer.analyze('static/dependencies/root.html');

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
          Array.from(inlineOnly!.getByKind('document'))
              .map((d) => d.parsedDocument.type),
          ['html', 'js', 'css']);

      const leaf =
          root.getOnlyAtId('document', 'static/dependencies/leaf.html');
      assert.deepEqual(Array.from(leaf!.getByKind('document')), [leaf]);

      const inlineAndImports = root.getOnlyAtId(
          'document', 'static/dependencies/inline-and-imports.html');
      assert.deepEqual(
          Array.from(inlineAndImports!.getByKind('document'))
              .map((d) => d.parsedDocument.type),
          ['html', 'js', 'html', 'html', 'css']);
      const inFolder = root.getOnlyAtId(
          'document', 'static/dependencies/subfolder/in-folder.html');
      assert.deepEqual(
          Array.from(inFolder!.getByKind('document')).map(d => d.url), [
            'static/dependencies/subfolder/in-folder.html',
            'static/dependencies/subfolder/subfolder-sibling.html'
          ]);

      // check de-duplication
      assert.equal(
          inlineAndImports!.getOnlyAtId(
              'document', 'static/dependencies/subfolder/in-folder.html'),
          inFolder);
    });

    test(`rejects for files that don't exist`, async() => {
      await invertPromise(analyzer.analyze('/static/does_not_exist'));
    });

    test('handles documents from multiple calls to analyze()', async() => {
      await analyzer.analyze('static/caching/file1.html');
      await analyzer.analyze('static/caching/file2.html');
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
      const features = <ScannedInlineDocument[]>(
          await analyzer['_getScannedFeatures'](document));

      assert.equal(features.length, 2);
      assert.instanceOf(features[0], ScannedInlineDocument);
      assert.instanceOf(features[1], ScannedInlineDocument);
    });

    const testName =
        'HTML inline documents can be cloned, modified, and stringified';
    test(testName, async() => {
      const contents = stripIndent(`
        <div>
          <script>
            console.log('foo');
          </script>
          <style>
            body {
              color: blue;
            }
          </style>
        </div>
      `).trim();
      const expectedContents = stripIndent(`
        <div>
          <script>
            console.log('bar');
          </script>
          <style>
            body {
              color: red;
            }
          </style>
        </div>
      `).trim();
      const origDocument = await analyzer.analyze('test-doc.html', contents);
      const document = clone(origDocument);

      // In document, we'll change `foo` to `bar` in the js and `blue` to
      // `red` in the css.
      const jsDocs = document.getByKind('js-document') as Set<Document>;
      assert.equal(1, jsDocs.size);
      const jsDoc = jsDocs.values().next().value;
      (jsDoc.parsedDocument as JavaScriptDocument).visit([{
        enterCallExpression(node: estree.CallExpression) {
          node.arguments =
              [{type: 'Literal', value: 'bar', raw: 'bar'}] as estree.Literal[];
        }
      }]);

      const cssDocs = document.getByKind('css-document') as Set<Document>;
      assert.equal(1, cssDocs.size);
      const cssDoc = cssDocs.values().next().value;
      (cssDoc.parsedDocument as ParsedCssDocument).visit([{
        visit(node: shady.Node) {
          if (node.type === 'expression' && node.text === 'blue') {
            node.text = 'red';
          }
        }
      }]);

      // We can stringify the clone and get the modified contents, and
      // stringify the original and still get the original contents.
      assert.deepEqual(document.stringify(), expectedContents);
      assert.deepEqual(origDocument.stringify(), contents);
    });
  });

  suite('legacy tests', () => {

    // ported from old js-parser_test.js
    // FIXME(rictic): I've temporarily disabled most recognition of Polymer ES6
    //     classes because the scanner is buggy and triggers when it shouldn't.
    test.skip('parses classes', async() => {
      const document = await analyzer.analyze('static/es6-support.js');

      const elements = Array.from(document.getByKind('polymer-element'));
      assert.deepEqual(
          elements.map(e => e.tagName), ['test-seed', 'test-element']);
      const testSeed = elements[0];

      assert.deepEqual(
          testSeed.behaviorAssignments, ['Behavior1', 'Behavior2']);
      assert.equal(testSeed.tagName, 'test-seed');

      assert.equal(testSeed.observers.length, 2);
      assert.equal(testSeed.properties.length, 4);

      assert.deepEqual(
          testSeed.events.map(e => e.name), ['fired-event', 'data-changed']);
    });
  });
});
