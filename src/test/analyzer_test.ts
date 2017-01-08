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
import * as estree from 'estree';
import * as path from 'path';
import * as shady from 'shady-css-parser';

import {Analyzer} from '../analyzer';
import {ParsedCssDocument} from '../css/css-document';
import {ParsedHtmlDocument} from '../html/html-document';
import {HtmlParser} from '../html/html-parser';
import {ScriptTagImport} from '../html/html-script-tag';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {Document, Import, ScannedImport, ScannedInlineDocument} from '../model/model';
import {FSUrlLoader} from '../url-loader/fs-url-loader';
import {UrlLoader} from '../url-loader/url-loader';
import {UrlResolver} from '../url-loader/url-resolver';
import {Deferred} from '../utils';

import {invertPromise} from './test-utils';

import stripIndent = require('strip-indent');

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
          const document =
              await analyzer.analyze('static/html-missing-behaviors.html');
          // TODO(#372): this should be false, we should treat inline documents
          //     as not requiring `deep` to be true.
          const warnings = document.getWarnings(true);
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
          const document = await analyzer.analyze(
              'static/chained-missing-behavior/index.html');
          const chainedDocument = document.getOnlyAtId(
              'document', 'static/chained-missing-behavior/chained.html')!;
          const expectedWarning = {
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
          // has itself and an inline document, but not the sub-document. For
          // now check that this fixture has 4 documents: behavior.html,
          // subbehavior.html, and their inline js documents
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
        'an inline document can find behaviors from its container document',
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
              'static/dependencies/subfolder/subfolder-sibling.html',
              'html',
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

    test('handles mutually recursive documents', async() => {
      const document = await analyzer.analyze('static/circular/mutual-a.html');
      const shallowFeatures = document.getFeatures(false);
      assert.deepEqual(
          Array.from(shallowFeatures)
              .filter(f => f.kinds.has('document'))
              .map(f => (f as Document).url),
          ['static/circular/mutual-a.html']);
      assert.deepEqual(
          Array.from(shallowFeatures)
              .filter(f => f.kinds.has('import'))
              .map(f => (f as Import).url),
          ['static/circular/mutual-b.html']);

      const deepFeatures = document.getFeatures(true);
      assert.deepEqual(
          Array.from(deepFeatures)
              .filter(f => f.kinds.has('document'))
              .map(f => (f as Document).url),
          ['static/circular/mutual-a.html', 'static/circular/mutual-b.html']);
      assert.deepEqual(
          Array.from(deepFeatures)
              .filter(f => f.kinds.has('import'))
              .map(f => (f as Import).url),
          ['static/circular/mutual-b.html', 'static/circular/mutual-a.html']);
    });

    test(
        'handles parallel analyses of mutually recursive documents',
        async() => {
          // At one point this deadlocked, or threw a _makeDocument error.
          await Promise.all([
            analyzer.analyze('static/circular/mutual-a.html'),
            analyzer.analyze('static/circular/mutual-b.html')
          ]);
        });

    test('handles a document importing itself', async() => {
      const document =
          await analyzer.analyze('static/circular/self-import.html');
      const features = document.getFeatures(true);
      assert.deepEqual(
          Array.from(features)
              .filter(f => f.kinds.has('document'))
              .map(f => (f as Document).url),
          ['static/circular/self-import.html']);
      assert.deepEqual(
          Array.from(features)
              .filter(f => f.kinds.has('import'))
              .map(f => (f as Import).url),
          [
            'static/circular/self-import.html',
            'static/circular/self-import.html'
          ]);
    });

    // TODO(justinfagnani): move into race condition tests?
    test('handles a shared dependency', async() => {
      let documents = await Promise.all([
        analyzer.analyze('static/diamond/a.html'),
        analyzer.analyze('static/diamond/root.html'),
      ]);

      const contents = documents.map((d) => d.parsedDocument.contents);
      documents = await Promise.all([
        analyzer.analyze('static/diamond/a.html', contents[0]),
        analyzer.analyze('static/diamond/root.html'),
      ]);

      const root = documents[1];

      const localFeatures = root.getFeatures(false);
      const kinds = Array.from(localFeatures).map(f => Array.from(f.kinds));
      assert.deepEqual(kinds, [
        ['document', 'html-document'],
        ['import', 'html-import'],
        ['import', 'html-import']
      ]);
    });

  });

  // TODO: reconsider whether we should test these private methods.
  suite('_parse()', () => {

    test('loads and parses an HTML document', async() => {
      const doc = await analyzer['_cacheContext']['_parse'](
          'static/html-parse-target.html');
      assert.instanceOf(doc, ParsedHtmlDocument);
      assert.equal(doc.url, 'static/html-parse-target.html');
    });

    test('loads and parses a JavaScript document', async() => {
      const doc =
          await analyzer['_cacheContext']['_parse']('static/js-elements.js');
      assert.instanceOf(doc, JavaScriptDocument);
      assert.equal(doc.url, 'static/js-elements.js');
    });

    test('returns a Promise that rejects for non-existant files', async() => {
      await invertPromise(
          analyzer['_cacheContext']['_parse']('static/not-found'));
    });
  });

  suite('_getScannedFeatures()', () => {
    test('default import scanners', async() => {
      const contents = `<html><head>
          <link rel="import" href="polymer.html">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head></html>`;
      const document = new HtmlParser().parse(contents, 'test.html');
      const features = <ScannedImport[]>(
          await analyzer['_cacheContext']['_getScannedFeatures'](document));
      assert.deepEqual(
          features.map(e => e.type),
          ['html-import', 'html-script', 'html-style']);
      assert.deepEqual(
          features.map(e => e.url),  //
          ['polymer.html', 'foo.js', 'foo.css']);
    });

    test('polymer css import scanner', async() => {
      const contents = `<html><head>
          <link rel="import" type="css" href="foo.css">
        </head>
        <body>
          <dom-module>
            <link rel="import" type="css" href="bar.css">
          </dom-module>
        </body></html>`;
      const document = new HtmlParser().parse(contents, 'test.html');
      const features =
          <ScannedImport[]>(
              await analyzer['_cacheContext']['_getScannedFeatures'](document))
              .filter(e => e instanceof ScannedImport);
      assert.equal(features.length, 1);
      assert.equal(features[0].type, 'css-import');
      assert.equal(features[0].url, 'bar.css');
    });

    test('HTML inline document scanners', async() => {
      const contents = `<html><head>
          <script>console.log('hi')</script>
          <style>body { color: red; }</style>
        </head></html>`;
      const document = new HtmlParser().parse(contents, 'test.html');
      const features = <ScannedInlineDocument[]>(
          await analyzer['_cacheContext']['_getScannedFeatures'](document));

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

  suite('analyzePackage', () => {
    test('produces a project with the right documents', async() => {
      const analyzer = new Analyzer({
        urlLoader: new FSUrlLoader(path.join(__dirname, 'static', 'project'))
      });
      const project = await analyzer.analyzePackage();

      // The root documents of the project are a minimal set of documents whose
      // imports touch every document in the project.
      assert.deepEqual(
          Array.from(project['_documents']).map(d => d.url).sort(),
          ['cyclic-a.html', 'root.html', 'subdir/root-in-subdir.html']
              .sort(), );

      // All elements in the project, as well as all elements in its
      // bower_components directory that are reachable from imports in the
      // project.
      assert.deepEqual(
          Array.from(project.getByKind('element')).map(e => e.tagName).sort(), [
            'root-root',
            'leaf-leaf',
            'cyclic-a',
            'cyclic-b',
            'imported-dependency',
            'root-in-subdir',
            'subdir-leaf'
          ].sort());
    });
  });

  suite('race conditions and caching', () => {

    class RacyUrlLoader implements UrlLoader {
      constructor(
          public pathToContentsMap: Map<string, string>,
          private waitFunction: () => Promise<void>) {
      }
      canLoad() {
        return true;
      }
      async load(path: string) {
        await this.waitFunction();
        const contents = this.pathToContentsMap.get(path);
        if (contents != null) {
          return contents;
        }
        throw new Error(`no known contents for ${path}`);
      }
    }

    const editorSimulator = async(waitFn: () => Promise<void>) => {
      // Here we're simulating a lot of noop-changes to base.html, which has
      // two imports, which mutually import a common dep. This stresses the
      // analyzer's caching.

      const contentsMap = new Map<string, string>([
        [
          'base.html',
          `<link rel="import" href="a.html">\n<link rel="import" href="b.html">`
        ],
        ['a.html', `<link rel="import" href="common.html">`],
        ['b.html', `<link rel="import" href="common.html">`],
        ['common.html', `<custom-el></custom-el>`],
      ]);
      const analyzer =
          new Analyzer({urlLoader: new RacyUrlLoader(contentsMap, waitFn)});
      const promises: Promise<Document>[] = [];
      const intermediatePromises: Promise<void>[] = [];
      for (let i = 0; i < 1; i++) {
        await waitFn();
        for (const entry of contentsMap) {
          // Randomly edit some files.
          const path = entry[0];
          const contents = entry[1];
          if (Math.random() > 0.5) {
            analyzer.analyze(path, contents);
            if (Math.random() > 0.5) {
              const p = analyzer.analyze(path, contents);
              const cacheContext = analyzer['_cacheContext'];
              intermediatePromises.push((async() => {
                await p;
                const docs = Array.from(
                    cacheContext['_cache'].analyzedDocuments.values());
                assert.isTrue(new Set(docs.map(d => d.url).sort()).has(path));
              })());
            }
          }
          promises.push(analyzer.analyze('base.html'));
          await Promise.all(promises);
        }
        // Analyze the base file
        promises.push(analyzer.analyze('base.html'));
        await Promise.all(promises);
      }
      // Assert that all edits went through fine.
      await Promise.all(intermediatePromises);
      // Assert that the every analysis of 'base.html' after each batch of edits
      // was correct, and doesn't have missing or inconsistent results.
      const documents = await Promise.all(promises);
      for (const document of documents) {
        assert.deepEqual(document.url, 'base.html');
        const localFeatures = document.getFeatures(false);
        const kinds = Array.from(localFeatures).map(f => Array.from(f.kinds));
        const message = `context: ${document['_context']._generation
        } localFeatures: ${JSON.stringify(
            Array.from(localFeatures).map((f) => ({
                                            kinds: Array.from(f.kinds),
                                            ids: Array.from(f.identifiers)
                                          })))}`;
        assert.deepEqual(
            kinds,
            [
              ['document', 'html-document'],
              ['import', 'html-import'],
              ['import', 'html-import']
            ],
            message);
        const imports = Array.from(document.getByKind('import'));
        assert.sameMembers(
            imports.map(m => m.url),
            ['a.html', 'b.html', 'common.html', 'common.html']);
        const docs = Array.from(document.getByKind('document'));
        assert.sameMembers(
            docs.map(d => d.url),
            ['a.html', 'b.html', 'base.html', 'common.html']);
        const refs = Array.from(document.getByKind('element-reference'));
        assert.sameMembers(refs.map(ref => ref.tagName), ['custom-el']);
      }
    };

    test('editor simulator of imports that import a common dep', async() => {
      const waitTimes: number[] = [];
      const randomWait = () => new Promise<void>((resolve) => {
        const waitTime = Math.random() * 30;
        waitTimes.push(waitTime);
        setTimeout(resolve, waitTime);
      });
      try {
        await editorSimulator(randomWait);
      } catch (err) {
        console.error('Wait times to reproduce this failure:');
        console.error(JSON.stringify(waitTimes));
        throw err;
      }
    });

    /**
     * This is a tool for reproducing and debugging a failure of the editor
     * simulator test above, but only at the exact same commit, as it's
     * sensitive to the order of internal operations of the analyzer. So this
     * code with a defined list of wait times should not be checked in.
     *
     * It's also worth noting that this code will be dependent on many other
     * system factors, so it's only somewhat more reproducible, and may not
     * end
     * up being very useful. If it isn't, we should delete it.
     */
    test.skip('somewhat more reproducable editor simulator', async() => {
      // Replace waitTimes' value with the array of wait times that's logged
      // to the console when the random editor test fails.
      const waitTimes: number[] = [];

      const reproducableWait = () => new Promise<void>((resolve) => {
        const waitTime = waitTimes.shift();
        if (waitTime == null) {
          throw new Error(
              'Was asked for more random waits than the ' +
              'given array of wait times');
        }
        setTimeout(resolve, waitTime);
      });
      await editorSimulator(reproducableWait);
    });

    suite('deterministic tests', () => {
      // Deterministic tests extracted from various failures of the above
      // random
      // test.

      /**
       * This is an asynchronous keyed queue, useful for controlling the order
       * of results in order to make tests more deterministic.
       *
       * It's intended to be used in fake loaders, scanners, etc, where the
       * test
       * provides the intended result on a file by file basis, with control
       * over
       * the order in which the results come in.
       */
      class KeyedQueue<Key, Result> {
        private _requests = new Map<Key, Deferred<Result>[]>();
        private _results = new Map<Key, Result[]>();

        async request(key: Key): Promise<Result> {
          const results = this._results.get(key) || [];
          if (results.length > 0) {
            return results.shift()!;
          }
          const deferred = new Deferred<Result>();
          const deferreds = this._requests.get(key) || [];
          this._requests.set(key, deferreds);
          deferreds.push(deferred);
          return deferred.promise;
        }

        /**
         * Resolves the next unfulfilled request for the given key with the
         * given value.
         */
        resolve(key: Key, value: Result) {
          const requests = this._requests.get(key) || [];
          if (requests.length > 0) {
            const request = requests.shift()!;
            request.resolve(value);
            return;
          }
          const results = this._results.get(key) || [];
          this._results.set(key, results);
          results.push(value);
        }

        toString() {
          return JSON.stringify({
            openRequests: Array.from(this._requests.keys()),
            openResponses: Array.from(this._results.keys())
          });
        }
      }

      class DeterministicUrlLoader implements UrlLoader {
        queue = new KeyedQueue<string, string>();
        canLoad(_url: string) {
          return true;
        }

        async load(url: string) {
          return this.queue.request(url);
        }
      }

      class NoopUrlLoader implements UrlLoader {
        canLoad() {
          return true;
        }
        async load(): Promise<string> {
          throw new Error(
              `Noop Url Loader isn't supposed to be actually called.`);
        }
      }

      /**
       * This crashed the analyzer as there was a race to _makeDocument,
       * violating its constraint that there not already be a resolved
       * Document
       * for a given path.
       *
       * This test came out of debugging this issue:
       *     https://github.com/Polymer/polymer-analyzer/issues/406
       */
      test('two edits of the same file back to back', async() => {
        const analyzer = new Analyzer({urlLoader: new NoopUrlLoader()});
        await Promise.all([
          analyzer.analyze('leaf.html', 'Hello'),
          analyzer.analyze('leaf.html', 'World')
        ]);
      });

      test.skip('something about the order of scanning?', async() => {
        // TODO(rictic): test out more analysis race conditions in a
        //     deterministic fashion.
        const urlLoader = new DeterministicUrlLoader();
        const analyzer = new Analyzer({urlLoader});
        const promises = [];
        promises.push(analyzer.analyze(
            'a.html', '<link rel="import" href="common.html">'));
        promises.push(analyzer.analyze(
            'b.html', '<link rel="import" href="common.html">'));
        promises.push(analyzer.analyze('base.html', `
<link rel="import" href="a.html">
<link rel="import" href="b.html">
`));

        urlLoader.queue.resolve('common.html', '');
        urlLoader.queue.resolve('common.html', '');
        await Promise.all(promises);
      });

      test('analyzes multiple imports of the same behavior', async() => {
        const documentA = await analyzer.analyze(
            'static/multiple-behavior-imports/element-a.html');
        const documentB = await analyzer.analyze(
            'static/multiple-behavior-imports/element-b.html');
        assert.deepEqual(documentA.getWarnings(true), []);
        assert.deepEqual(documentB.getWarnings(true), []);
      });

      test(
          'analyzes multiple imports of the same behavior simultaneously',
          async() => {
            const result = await Promise.all([
              analyzer.analyze(
                  'static/multiple-behavior-imports/element-a.html'),
              analyzer.analyze(
                  'static/multiple-behavior-imports/element-b.html')
            ]);
            const documentA = result[0];
            const documentB = result[1];
            assert.deepEqual(documentA.getWarnings(true), []);
            assert.deepEqual(documentB.getWarnings(true), []);
          });
    });
  });
});
