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

/// <reference path="../../../node_modules/@types/mocha/index.d.ts" />

import {assert, use} from 'chai';
import * as clone from 'clone';
import * as estree from 'estree';
import * as path from 'path';
import * as shady from 'shady-css-parser';

import {Analyzer} from '../../core/analyzer';
import {Deferred} from '../../core/utils';
import {ParsedCssDocument} from '../../css/css-document';
import {ParsedHtmlDocument} from '../../html/html-document';
import {HtmlParser} from '../../html/html-parser';
import {ScriptTagImport} from '../../html/html-script-tag';
import {JavaScriptDocument} from '../../javascript/javascript-document';
import {Document, Import, ScannedImport, ScannedInlineDocument, Severity} from '../../model/model';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';
import {InMemoryOverlayUrlLoader} from '../../url-loader/overlay-loader';
import {UrlLoader} from '../../url-loader/url-loader';

import {CodeUnderliner, invertPromise} from '../test-utils';

import chaiAsPromised = require('chai-as-promised');
import chaiSubset = require('chai-subset');
import stripIndent = require('strip-indent');

use(chaiSubset);
use(chaiAsPromised);

function getOnly<V>(iter: Iterable<V>): V {
  const arr = Array.from(iter);
  assert.equal(arr.length, 1);
  return arr[0]!;
}

const testDir = path.join(__dirname, '..');

suite('Analyzer', () => {
  let analyzer: Analyzer;
  let inMemoryOverlay: InMemoryOverlayUrlLoader;
  let underliner: CodeUnderliner;

  async function analyzeDocument(
      url: string, localAnalyzer?: Analyzer): Promise<Document> {
    localAnalyzer = localAnalyzer || analyzer;
    const document =
        (await localAnalyzer.analyze([url])).getDocument(url) as Document;
    assert.instanceOf(document, Document);
    return document;
  };

  setup(() => {
    const underlyingUrlLoader = new FSUrlLoader(testDir);
    inMemoryOverlay = new InMemoryOverlayUrlLoader(underlyingUrlLoader);
    analyzer = new Analyzer({urlLoader: inMemoryOverlay});
    underliner = new CodeUnderliner(inMemoryOverlay);
  });

  test('canLoad delegates to the urlLoader canLoad method', () => {
    assert.isTrue(analyzer.canLoad('/'), '/');
    assert.isTrue(analyzer.canLoad('/path'), '/path');
    assert.isFalse(analyzer.canLoad('../path'), '../path');
    assert.isFalse(analyzer.canLoad('http://host/'), 'http://host/');
    assert.isFalse(analyzer.canLoad('http://host/path'), 'http://host/path');
  });

  suite('canResolveUrl()', () => {
    test('canResolveUrl defaults to not resolving external urls', () => {
      assert.isTrue(analyzer.canResolveUrl('/path'), '/path');
      assert.isTrue(analyzer.canResolveUrl('../path'), '../path');
      assert.isFalse(analyzer.canResolveUrl('http://host'), 'http://host');
      assert.isFalse(
          analyzer.canResolveUrl('http://host/path'), 'http://host/path');
    });
  });

  suite('analyze()', () => {

    test(
        'analyzes a document with an inline Polymer element feature',
        async() => {
          const document = await analyzeDocument(
              'static/analysis/simple/simple-element.html');
          const elements = Array.from(
              document.getFeatures({kind: 'element', imported: false}));
          assert.deepEqual(elements.map((e) => e.tagName), ['simple-element']);
        });

    test(
        'analyzes a document with an external Polymer element feature',
        async() => {
          const document =
              await analyzeDocument('static/analysis/separate-js/element.html');
          const elements = Array.from(
              document.getFeatures({kind: 'element', imported: true}));
          assert.deepEqual(elements.map((e) => e.tagName), ['my-element']);
        });

    test('gets source ranges of documents correct', async() => {
      const document = await analyzeDocument('static/dependencies/root.html');
      assert.deepEqual(await underliner.underline(document.sourceRange), `
<link rel="import" href="inline-only.html">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
<link rel="import" href="leaf.html">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
<link rel="import" href="inline-and-imports.html">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
<link rel="import" href="subfolder/in-folder.html">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
<link rel="lazy-import" href="lazy.html">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~

`);
    });

    test('analyzes inline scripts correctly', async() => {
      const document = await analyzeDocument(
          'static/inline-documents/inline-documents.html');
      const jsDocuments = document.getFeatures({kind: 'js-document'});
      assert.equal(jsDocuments.size, 1);
      const jsDocument = getOnly(jsDocuments);
      assert.isObject(jsDocument.astNode);
      assert.equal(jsDocument.astNode!.tagName, 'script');
      assert.deepEqual(await underliner.underline(jsDocument.sourceRange), `
  <script>
          ~
    console.log('hi');
~~~~~~~~~~~~~~~~~~~~~~
  </script>
~~`);
    });

    test('analyzes inline styles correctly', async() => {
      const document = await analyzeDocument(
          'static/inline-documents/inline-documents.html');
      const cssDocuments = document.getFeatures({kind: 'css-document'});
      const cssDocument = getOnly(cssDocuments);
      assert.isObject(cssDocument.astNode);
      assert.equal(cssDocument.astNode!.tagName, 'style');
      assert.deepEqual(await underliner.underline(cssDocument.sourceRange), `
  <style>
         ~
    body {
~~~~~~~~~~
      color: red;
~~~~~~~~~~~~~~~~~
    }
~~~~~
  </style>
~~`);
    });

    test('analyzes a document with an import', async() => {
      const document =
          await analyzeDocument('static/analysis/behaviors/behavior.html');
      const behaviors =
          Array.from(document.getFeatures({kind: 'behavior', imported: true}));
      assert.deepEqual(
          behaviors.map((b) => b.className),
          ['MyNamespace.SubBehavior', 'MyNamespace.SimpleBehavior']);
    });

    test(
        'creates "missing behavior" warnings on imported documents without elements',
        async() => {
          const document = await analyzeDocument(
              'static/chained-missing-behavior/index.html');
          const chainedDocument = getOnly(document.getFeatures({
            kind: 'document',
            id: 'static/chained-missing-behavior/chained.html',
            imported: true
          }));
          const expectedWarning = {
            code: 'unknown-polymer-behavior',
            message:
                'Unable to resolve behavior `NotFoundBehavior`. Did you import it? Is it annotated with @polymerBehavior?',
            severity: 1,
            sourceRange: {
              end: {column: 55, line: 2},
              start: {column: 39, line: 2},
              file: 'static/chained-missing-behavior/chained.html'
            },
          };
          assert.deepEqual(document.getWarnings({imported: false}), []);
          assert.deepEqual(
              document.getWarnings({imported: true}).map((w) => w.toJSON()),
              [expectedWarning]);
          assert.deepEqual(
              chainedDocument.getWarnings({imported: false})
                  .map((w) => w.toJSON()),
              [expectedWarning]);
        });

    test(
        'an inline document can find features from its container document',
        async() => {
          const document =
              await analyzeDocument('static/analysis/behaviors/behavior.html');
          const localDocuments =
              document.getFeatures({kind: 'document', imported: false});
          assert.equal(localDocuments.size, 2);  // behavior.html and its inline

          const allDocuments =
              document.getFeatures({kind: 'document', imported: true});
          assert.equal(allDocuments.size, 4);

          const inlineDocuments =
              Array.from(document.getFeatures({imported: false}))
                  .filter(
                      (d) => d instanceof Document && d.isInline) as Document[];
          assert.equal(inlineDocuments.length, 1);

          // This is the main purpose of the test: get a feature from
          // the inline
          // document that's imported by the container document
          const behaviorJsDocument = inlineDocuments[0];
          const subBehavior = getOnly(behaviorJsDocument.getFeatures({
            kind: 'behavior',
            id: 'MyNamespace.SubBehavior',
            imported: true
          }));
          assert.equal(subBehavior!.className, 'MyNamespace.SubBehavior');
        });

    test(
        'an inline script can find features from its container document',
        async() => {
          const document = await analyzeDocument(
              'static/script-tags/inline/test-element.html');
          const inlineDocuments = Array
                                      .from(document.getFeatures(
                                          {kind: 'document', imported: false}))
                                      .filter((d) => d.isInline);
          assert.equal(inlineDocuments.length, 1);
          const inlineJsDocument = inlineDocuments[0];

          // The inline document can find the container's imported
          // features
          const subBehavior = getOnly(inlineJsDocument.getFeatures(
              {kind: 'behavior', id: 'TestBehavior', imported: true}));
          assert.equal(subBehavior!.className, 'TestBehavior');
        });

    test(
        'an external script can find features from its container document',
        async() => {
          const document = await analyzeDocument(
              'static/script-tags/external/test-element.html');

          const htmlScriptTags = Array.from(
              document.getFeatures({kind: 'html-script', imported: false}));
          assert.equal(htmlScriptTags.length, 1);

          const htmlScriptTag = htmlScriptTags[0] as ScriptTagImport;
          const scriptDocument = htmlScriptTag.document;

          // The inline document can find the container's imported
          // features
          const subBehavior = getOnly(scriptDocument.getFeatures(
              {kind: 'behavior', id: 'TestBehavior', imported: true}))!;
          assert.equal(subBehavior.className, 'TestBehavior');
        });


    // This test is nearly identical to the previous, but covers a different
    // issue.
    // PolymerElement must find behaviors while resolving, and if inline
    // documents don't add a document feature for their container until after
    // resolution, then the element can't find them and throws.
    test(
        'an inline document can find behaviors from its container document',
        async() => {
          const document = await analyzeDocument(
              'static/analysis/behaviors/elementdir/element.html');

          const documents =
              document.getFeatures({kind: 'document', imported: false});
          assert.equal(documents.size, 2);

          const inlineDocuments = Array.from(documents).filter(
              (d) => d instanceof Document && d.isInline) as Document[];
          assert.equal(inlineDocuments.length, 1);

          // This is the main purpose of the test: get a feature
          // from the inline
          // document that's imported by the container document
          const behaviorJsDocument = inlineDocuments[0];
          const subBehavior = getOnly(behaviorJsDocument.getFeatures({
            kind: 'behavior',
            id: 'MyNamespace.SubBehavior',
            imported: true
          }));
          assert.equal(subBehavior.className, 'MyNamespace.SubBehavior');
        });

    test('returns a Document with warnings for malformed files', async() => {
      const document = await analyzeDocument('static/malformed.html');
      assert(document.getWarnings({imported: false}).length >= 1);
    });

    test('analyzes transitive dependencies', async() => {
      const root = await analyzeDocument('static/dependencies/root.html');

      // If we ask for documents we get every document in evaluation order.
      const strictlyReachableDocuments = [
        ['static/dependencies/root.html', 'html', false],
        ['static/dependencies/inline-only.html', 'html', false],
        ['static/dependencies/inline-only.html', 'js', true],
        ['static/dependencies/inline-only.html', 'css', true],
        ['static/dependencies/leaf.html', 'html', false],
        ['static/dependencies/inline-and-imports.html', 'html', false],
        ['static/dependencies/inline-and-imports.html', 'js', true],
        ['static/dependencies/subfolder/in-folder.html', 'html', false],
        ['static/dependencies/subfolder/subfolder-sibling.html', 'html', false],
        ['static/dependencies/inline-and-imports.html', 'css', true],
      ];

      // If we ask for documents we get every document in
      // evaluation order.
      assert.deepEqual(
          Array
              .from(root.getFeatures(
                  {kind: 'document', imported: true, noLazyImports: true}))
              .map((d) => [d.url, d.parsedDocument.type, d.isInline]),
          strictlyReachableDocuments);

      assert.deepEqual(
          Array.from(root.getFeatures({kind: 'document', imported: true}))
              .map((d) => [d.url, d.parsedDocument.type, d.isInline]),
          strictlyReachableDocuments.concat(
              [['static/dependencies/lazy.html', 'html', false]]));


      // If we ask for imports we get the import statements in evaluation order.
      // Unlike documents, we can have duplicates here because imports exist in
      // distinct places in their containing docs.
      assert.deepEqual(
          Array.from(root.getFeatures({kind: 'import', imported: true}))
              .map((d) => d.url),
          [
            'static/dependencies/inline-only.html',
            'static/dependencies/leaf.html',
            'static/dependencies/inline-and-imports.html',
            'static/dependencies/subfolder/in-folder.html',
            'static/dependencies/subfolder/subfolder-sibling.html',
            'static/dependencies/subfolder/in-folder.html',
            'static/dependencies/lazy.html',
          ]);

      const inlineOnly = getOnly(root.getFeatures({
        kind: 'document',
        id: 'static/dependencies/inline-only.html',
        imported: true
      }));
      assert.deepEqual(
          Array
              .from(inlineOnly!.getFeatures({kind: 'document', imported: true}))
              .map((d) => d.parsedDocument.type),
          ['html', 'js', 'css']);

      const leaf = getOnly(root.getFeatures({
        kind: 'document',
        id: 'static/dependencies/leaf.html',
        imported: true
      }));
      assert.deepEqual(
          Array.from(leaf.getFeatures({kind: 'document', imported: true})),
          [leaf]);

      const inlineAndImports = getOnly(root.getFeatures({
        kind: 'document',
        id: 'static/dependencies/inline-and-imports.html',
        imported: true
      }));
      assert.deepEqual(
          Array
              .from(inlineAndImports.getFeatures(
                  {kind: 'document', imported: true}))
              .map((d) => d.parsedDocument.type),
          ['html', 'js', 'html', 'html', 'css']);
      const inFolder = getOnly(root.getFeatures({
        kind: 'document',
        id: 'static/dependencies/subfolder/in-folder.html',
        imported: true
      }));
      assert.deepEqual(
          Array.from(inFolder.getFeatures({kind: 'document', imported: true}))
              .map((d) => d.url),
          [
            'static/dependencies/subfolder/in-folder.html',
            'static/dependencies/subfolder/subfolder-sibling.html'
          ]);

      // check de-duplication
      assert.equal(
          getOnly(inlineAndImports!.getFeatures({
            kind: 'document',
            id: 'static/dependencies/subfolder/in-folder.html',
            imported: true
          })),
          inFolder);
    });

    test(`warns for files that don't exist`, async() => {
      const url = '/static/does_not_exist';
      const result = await analyzer.analyze([url]);
      const warning = result.getDocument(url);
      assert.isFalse(warning instanceof Document);
    });

    test('handles documents from multiple calls to analyze()', async() => {
      await analyzer.analyze(['static/caching/file1.html']);
      await analyzer.analyze(['static/caching/file2.html']);
    });

    test('handles mutually recursive documents', async() => {
      const document = await analyzeDocument('static/circular/mutual-a.html');
      const shallowFeatures = document.getFeatures({imported: false});
      assert.deepEqual(
          Array.from(shallowFeatures)
              .filter((f) => f.kinds.has('document'))
              .map((f) => (f as Document).url),
          ['static/circular/mutual-a.html']);
      assert.deepEqual(
          Array.from(shallowFeatures)
              .filter((f) => f.kinds.has('import'))
              .map((f) => (f as Import).url),
          ['static/circular/mutual-b.html']);

      const deepFeatures = document.getFeatures({imported: true});
      assert.deepEqual(
          Array.from(deepFeatures)
              .filter((f) => f.kinds.has('document'))
              .map((f) => (f as Document).url),
          ['static/circular/mutual-a.html', 'static/circular/mutual-b.html']);
      assert.deepEqual(
          Array.from(deepFeatures)
              .filter((f) => f.kinds.has('import'))
              .map((f) => (f as Import).url),
          ['static/circular/mutual-b.html', 'static/circular/mutual-a.html']);
    });

    test(
        'handles parallel analyses of mutually recursive documents',
        async() => {
          // At one point this deadlocked, or threw
          // a _makeDocument error.
          await Promise.all([
            analyzer.analyze(['static/circular/mutual-a.html']),
            analyzer.analyze(['static/circular/mutual-b.html'])
          ]);
        });

    test('handles a document importing itself', async() => {
      const document =
          await analyzeDocument('static/circular/self-import.html');
      const features = document.getFeatures({imported: true});
      assert.deepEqual(
          Array.from(features)
              .filter((f) => f.kinds.has('document'))
              .map((f) => (f as Document).url),
          ['static/circular/self-import.html']);
      assert.deepEqual(
          Array.from(features)
              .filter((f) => f.kinds.has('import'))
              .map((f) => (f as Import).url),
          [
            'static/circular/self-import.html',
            'static/circular/self-import.html'
          ]);
    });

    suite('handles documents with spaces in filename', () => {

      test('given a url with unencoded spaces to analyze', async() => {
        const document = await analyzeDocument('static/spaces in file.html');
        const features = document.getFeatures({imported: true});
        assert.deepEqual(
            Array.from(features)
                .filter((f) => f.kinds.has('document'))
                .map((f) => (f as Document).url),
            [
              'static/spaces%20in%20file.html',
              'static/dependencies/spaces%20in%20import.html'
            ]);
        assert.deepEqual(
            Array.from(features)
                .filter((f) => f.kinds.has('import'))
                .map((f) => (f as Import).url),
            ['static/dependencies/spaces%20in%20import.html']);
      });

      test('given a url with encoded spaces to analyze', async() => {
        const document =
            await analyzeDocument('static/spaces%20in%20file.html');
        const features = document.getFeatures({imported: true});
        assert.deepEqual(
            Array.from(features)
                .filter((f) => f.kinds.has('document'))
                .map((f) => (f as Document).url),
            [
              'static/spaces%20in%20file.html',
              'static/dependencies/spaces%20in%20import.html'
            ]);
        assert.deepEqual(
            Array.from(features)
                .filter((f) => f.kinds.has('import'))
                .map((f) => (f as Import).url),
            ['static/dependencies/spaces%20in%20import.html']);
      });
    });
  });

  // TODO: reconsider whether we should test these private methods.
  suite('_parse()', () => {

    test('loads and parses an HTML document', async() => {
      const context = await getContext(analyzer);
      const doc = await context['_parse']('static/html-parse-target.html');
      assert.instanceOf(doc, ParsedHtmlDocument);
      assert.equal(doc.url, 'static/html-parse-target.html');
    });

    test('loads and parses a JavaScript document', async() => {
      const context = await getContext(analyzer);
      const doc = await context['_parse']('static/js-elements.js');
      assert.instanceOf(doc, JavaScriptDocument);
      assert.equal(doc.url, 'static/js-elements.js');
    });

    test('returns a Promise that rejects for non-existant files', async() => {
      const context = await getContext(analyzer);
      await invertPromise(context['_parse']('static/not-found'));
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
      const context = await getContext(analyzer);
      const features = ((await context['_getScannedFeatures'](document))
                            .features as ScannedImport[]);
      assert.deepEqual(
          features.map((e) => e.type),
          ['html-import', 'html-script', 'html-style']);
      assert.deepEqual(
          features.map((e) => e.url),  //
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
      const context = await getContext(analyzer);
      const features =
          (await context['_getScannedFeatures'](document))
              .features.filter(
                  (e) => e instanceof ScannedImport) as ScannedImport[];
      assert.equal(features.length, 1);
      assert.equal(features[0].type, 'css-import');
      assert.equal(features[0].url, 'bar.css');
    });

    test('HTML inline document scanners', async() => {
      const contents = `<html><head>
          <script>console.log('hi')</script>
          <style>body { color: red; }</style>
        </head></html>`;
      const context = await getContext(analyzer);
      const document = new HtmlParser().parse(contents, 'test.html');
      const features = ((await context['_getScannedFeatures'](document))
                            .features) as ScannedInlineDocument[];

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
      const modifiedContents = stripIndent(`
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
      inMemoryOverlay.urlContentsMap.set('test-doc.html', contents);
      const origDocument = await analyzeDocument('test-doc.html');
      const document = clone(origDocument);

      // In document, we'll change `foo` to
      // `bar` in the js and `blue` to
      // `red` in the css.
      const jsDocs =
          document.getFeatures({kind: 'js-document', imported: true});
      assert.equal(1, jsDocs.size);
      const jsDoc = getOnly(jsDocs);
      (jsDoc.parsedDocument as JavaScriptDocument).visit([{
        enterCallExpression(node: estree.CallExpression) {
          node.arguments =
              [{type: 'Literal', value: 'bar', raw: 'bar'}] as estree.Literal[];
        }
      }]);

      const cssDocs =
          document.getFeatures({kind: 'css-document', imported: true});
      assert.equal(1, cssDocs.size);
      const cssDoc = getOnly(cssDocs);
      (cssDoc.parsedDocument as ParsedCssDocument).visit([{
        visit(node: shady.Node) {
          if (node.type === 'expression' && node.text === 'blue') {
            node.text = 'red';
          }
        }
      }]);

      // We can stringify the clone and get the modified contents, and
      // stringify the original and still get the original contents.
      assert.deepEqual(document.stringify(), modifiedContents);
      assert.deepEqual(origDocument.stringify(), contents);
    });
  });

  test('analyzes a document with a namespace', async() => {
    const document = await analyzeDocument('static/namespaces/import-all.html');
    if (!(document instanceof Document)) {
      throw new Error(`Expected Document, got ${document}`);
    }

    const namespaces =
        Array.from(document.getFeatures({kind: 'namespace', imported: true}));
    assert.deepEqual(namespaces.map((b) => b.name), [
      'ExplicitlyNamedNamespace',
      'ExplicitlyNamedNamespace.NestedNamespace',
      'ImplicitlyNamedNamespace',
      'ImplicitlyNamedNamespace.NestedNamespace',
      'ParentNamespace.FooNamespace',
      'ParentNamespace.BarNamespace',
      'DynamicNamespace.ComputedProperty',
      'DynamicNamespace.UnanalyzableComputedProperty',
      'DynamicNamespace.Aliased',
      'DynamicNamespace.InferredComputedProperty',
    ]);
  });

  // TODO(rictic): move duplicate checks into scopes/analysis results.
  //     No where else has reliable knowledge of the clash.
  test.skip(
      'creates warnings when duplicate namespaces are analyzed', async() => {
        const document = await analyzer.analyze(
            ['static/namespaces/import-duplicates.html']);
        const namespaces =
            Array.from(document.getFeatures({kind: 'namespace'}));
        assert.deepEqual(namespaces.map((b) => b.name), [
          'ExplicitlyNamedNamespace',
          'ExplicitlyNamedNamespace.NestedNamespace',
        ]);
        const warnings = document.getWarnings();
        assert.containSubset(warnings, [
          {
            message:
                'Found more than one namespace named ExplicitlyNamedNamespace.',
            severity: Severity.WARNING,
            code: 'multiple-javascript-namespaces',
          }
        ]);
        assert.deepEqual(await underliner.underline(warnings), [`
var DuplicateNamespace = {};
~~~~~~~~~~~~~~~~~~~~~~~~~~~~`]);
      });

  suite('analyzePackage', () => {

    test('produces a package with the right documents', async() => {
      const analyzer = new Analyzer({
        urlLoader: new FSUrlLoader(path.join(testDir, 'static', 'project'))
      });
      const pckage = await analyzer.analyzePackage();

      // The root documents of the package are a minimal set of documents whose
      // imports touch every document in the package.
      assert.deepEqual(
          Array.from(pckage['_searchRoots']).map((d) => d.url).sort(),
          ['cyclic-a.html', 'root.html', 'subdir/root-in-subdir.html'].sort());

      // Note that this does not contain the bower_components/ files
      assert.deepEqual(
          Array.from(pckage.getFeatures({kind: 'document'}))
              .filter((d) => !d.isInline)
              .map((d) => d.url)
              .sort(),
          [
            'cyclic-a.html',
            'cyclic-b.html',
            'root.html',
            'leaf.html',
            'subdir/subdir-leaf.html',
            'subdir/root-in-subdir.html'
          ].sort());

      // And this does contain the one imported file in bower_components/
      assert.deepEqual(
          Array
              .from(pckage.getFeatures(
                  {kind: 'document', externalPackages: true}))
              .filter((d) => !d.isInline)
              .map((d) => d.url)
              .sort(),
          [
            'cyclic-a.html',
            'cyclic-b.html',
            'root.html',
            'leaf.html',
            'subdir/subdir-leaf.html',
            'subdir/root-in-subdir.html',
            'bower_components/imported.html',
          ].sort());

      const packageElements = [
        'root-root',
        'leaf-leaf',
        'cyclic-a',
        'cyclic-b',
        'root-in-subdir',
        'subdir-leaf'
      ];

      // All elements in the package
      assert.deepEqual(
          Array.from(pckage.getFeatures({kind: 'element'}))
              .map((e) => e.tagName)
              .sort(),
          packageElements.sort());

      // All elements in the package, as well as all elements in
      // its bower_components directory that are reachable from imports in the
      // package.
      assert.deepEqual(
          Array
              .from(
                  pckage.getFeatures({kind: 'element', externalPackages: true}))
              .map((e) => e.tagName)
              .sort(),
          packageElements.concat(['imported-dependency']).sort());
    });

    test('can get warnings from within and without the package', async() => {
      const analyzer = new Analyzer({
        urlLoader:
            new FSUrlLoader(path.join(testDir, 'static', 'project-with-errors'))
      });
      const pckage = await analyzer.analyzePackage();
      assert.deepEqual(
          Array.from(pckage['_searchRoots']).map((d) => d.url), ['index.html']);
      assert.deepEqual(
          pckage.getWarnings().map((w) => w.sourceRange.file), ['index.html']);
      assert.deepEqual(
          pckage.getWarnings({externalPackages: true})
              .map((w) => w.sourceRange.file)
              .sort(),
          ['bower_components/external-with-warnings.html', 'index.html']);
    });
  });

  suite('_fork', () => {
    test('returns an independent copy of Analyzer', async() => {
      inMemoryOverlay.urlContentsMap.set('a.html', 'a is shared');
      await analyzer.analyze(['a.html']);
      // Unmap a.html so that future reads of it will fail, thus testing the
      // cache.
      inMemoryOverlay.urlContentsMap.delete('a.html');

      const analyzer2 = await analyzer._fork();
      inMemoryOverlay.urlContentsMap.set('b.html', 'b for analyzer');
      await analyzer.analyze(['b.html']);
      inMemoryOverlay.urlContentsMap.set('b.html', 'b for analyzer2');
      await analyzer2.analyze(['b.html']);
      inMemoryOverlay.urlContentsMap.delete('b.html');

      const a1 = await analyzeDocument('a.html', analyzer);
      const a2 = await analyzeDocument('a.html', analyzer2);
      const b1 = await analyzeDocument('b.html', analyzer);
      const b2 = await analyzeDocument('b.html', analyzer2);

      assert.equal(a1.parsedDocument.contents, 'a is shared');
      assert.equal(a2.parsedDocument.contents, 'a is shared');
      assert.equal(b1.parsedDocument.contents, 'b for analyzer');
      assert.equal(b2.parsedDocument.contents, 'b for analyzer2');
    });

    test('supports overriding of urlLoader', async() => {
      const loader1 = {canLoad: () => true, load: async(u: string) => `${u} 1`};
      const loader2 = {canLoad: () => true, load: async(u: string) => `${u} 2`};
      const analyzer1 = new Analyzer({urlLoader: loader1});
      const a1 = await analyzeDocument('a.html', analyzer1);
      const analyzer2 = await analyzer1._fork({urlLoader: loader2});
      const a2 = await analyzeDocument('a.html', analyzer2);
      const b1 = await analyzeDocument('b.html', analyzer1);
      const b2 = await analyzeDocument('b.html', analyzer2);

      assert.equal(a1.parsedDocument.contents, 'a.html 1', 'a.html, loader 1');
      assert.equal(a2.parsedDocument.contents, 'a.html 1', 'a.html, in cache');
      assert.equal(b1.parsedDocument.contents, 'b.html 1', 'b.html, loader 1');
      assert.equal(b2.parsedDocument.contents, 'b.html 2', 'b.html, loader 2');
    });
  });

  suite('race conditions and caching', () => {
    test('maintain caches across multiple edits', async() => {
      // This is a regression test of a scenario where changing a dependency
      // did not properly update warnings of a file. The bug turned out to
      // be in the dependency graph, but this test seems useful enough to
      // keep around.
      // The specific warning is renaming a superclass without updating the
      // class which extends it.
      inMemoryOverlay.urlContentsMap.set('base.js', `
        class BaseElement extends HTMLElement {}
        customElements.define('base-elem', BaseElement);
      `);
      inMemoryOverlay.urlContentsMap.set('user.html', `
        <script src="./base.js"></script>
        <script>
          class UserElem extends BaseElement {}
          customElements.define('user-elem', UserElem);
        </script>
      `);
      const b1Doc = await analyzer.analyze(['base.js']);
      assert.deepEqual(b1Doc.getWarnings(), []);
      const u1Doc = await analyzer.analyze(['user.html']);
      assert.deepEqual(u1Doc.getWarnings(), []);

      inMemoryOverlay.urlContentsMap.set('base.js', `
        class NewSpelling extends HTMLElement {}
        customElements.define('base-elem', NewSpelling);
      `);
      analyzer.filesChanged(['base.js']);
      const b2Doc = await analyzer.analyze(['base.js']);
      assert.deepEqual(b2Doc.getWarnings(), []);
      const u2Doc = await analyzer.analyze(['user.html']);
      assert.notEqual(u1Doc, u2Doc);
      assert.equal(
          u2Doc.getWarnings()[0].message,
          'Unable to resolve superclass BaseElement');

      inMemoryOverlay.urlContentsMap.set('base.js', `
        class BaseElement extends HTMLElement {}
        customElements.define('base-elem', BaseElement);
      `);
      analyzer.filesChanged(['base.js']);
      const b3Doc = await analyzer.analyze(['base.js']);
      assert.deepEqual(b3Doc.getWarnings(), []);
      const u3Doc = await analyzer.analyze(['user.html']);
      assert.equal(u3Doc.getWarnings().length, 0);
    });

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
      // Here we're simulating a lot of noop-changes to base.html,
      // which has
      // two imports, which mutually import a common dep. This
      // stresses the
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
          if (Math.random() > 0.5) {
            analyzer.filesChanged([path]);
            analyzer.analyze([path]);
            if (Math.random() > 0.5) {
              analyzer.filesChanged([path]);
              const p = analyzer.analyze([path]);
              const cacheContext = await getContext(analyzer);
              intermediatePromises.push((async() => {
                await p;
                const docs = Array.from(
                    cacheContext['_cache'].analyzedDocuments.values());
                assert.isTrue(new Set(docs.map((d) => d.url).sort()).has(path));
              })());
            }
          }
          promises.push(analyzeDocument('base.html', analyzer));
          await Promise.all(promises);
        }
        // Analyze the base file
        promises.push(analyzeDocument('base.html', analyzer));
        await Promise.all(promises);
      }
      // Assert that all edits went through fine.
      await Promise.all(intermediatePromises);
      // Assert that the every analysis of 'base.html' after each
      // batch of edits
      // was correct, and doesn't have missing or inconsistent
      // results.
      const documents = await Promise.all(promises);
      for (const document of documents) {
        assert.deepEqual(document.url, 'base.html');
        const localFeatures = document.getFeatures({imported: false});
        const kinds = Array.from(localFeatures).map((f) => Array.from(f.kinds));
        const message =
            `localFeatures: ${
                              JSON.stringify(
                                  Array.from(localFeatures)
                                      .map((f) => ({
                                             kinds: Array.from(f.kinds),
                                             ids: Array.from(f.identifiers)
                                           })))
                            }`;
        assert.deepEqual(
            kinds,
            [
              ['document', 'html-document'],
              ['import', 'html-import'],
              ['import', 'html-import']
            ],
            message);
        const imports =
            Array.from(document.getFeatures({kind: 'import', imported: true}));
        assert.sameMembers(
            imports.map((m) => m.url),
            ['a.html', 'b.html', 'common.html', 'common.html']);
        const docs = Array.from(
            document.getFeatures({kind: 'document', imported: true}));
        assert.sameMembers(
            docs.map((d) => d.url),
            ['a.html', 'b.html', 'base.html', 'common.html']);
        const refs = Array.from(
            document.getFeatures({kind: 'element-reference', imported: true}));
        assert.sameMembers(refs.map((ref) => ref.tagName), ['custom-el']);
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
     * This is a tool for reproducing and debugging a failure of the
     * editor
     * simulator test above, but only at the exact same commit, as
     * it's
     * sensitive to the order of internal operations of the analyzer.
     * So this
     * code with a defined list of wait times should not be checked
     * in.
     *
     * It's also worth noting that this code will be dependent on many
     * other
     * system factors, so it's only somewhat more reproducible, and
     * may not
     * end
     * up being very useful. If it isn't, we should delete it.
     */
    test.skip('somewhat more reproducable editor simulator', async() => {
      // Replace waitTimes' value with the array of wait times
      // that's logged
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
      // Deterministic tests extracted from various failures of the
      // above
      // random
      // test.

      /**
       * This is an asynchronous keyed queue, useful for controlling
       * the
       * order
       * of results in order to make tests more deterministic.
       *
       * It's intended to be used in fake loaders, scanners, etc,
       * where the
       * test
       * provides the intended result on a file by file basis, with
       * control
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
         * Resolves the next unfulfilled request for the given key
         * with the
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
       * This crashed the analyzer as there was a race to
       * _makeDocument,
       * violating its constraint that there not already be a resolved
       * Document
       * for a given path.
       *
       * This test came out of debugging this issue:
       *     https://github.com/Polymer/polymer-analyzer/issues/406
       */
      test('two edits of the same file back to back', async() => {
        const overlay = new InMemoryOverlayUrlLoader(new NoopUrlLoader);
        const analyzer = new Analyzer({urlLoader: overlay});

        overlay.urlContentsMap.set('leaf.html', 'Hello');
        const p1 = analyzer.analyze(['leaf.html']);
        overlay.urlContentsMap.set('leaf.html', 'World');
        analyzer.filesChanged(['leaf.html']);
        const p2 = analyzer.analyze(['leaf.html']);
        await Promise.all([p1, p2]);
      });

      test('handles a shared dependency', async() => {
        const initialPaths =
            ['static/diamond/a.html', 'static/diamond/root.html'];
        let result = await analyzer.analyze(initialPaths);

        const documentA = result.getDocument(initialPaths[0]) as Document;
        inMemoryOverlay.urlContentsMap.set(
            'static/diamond/a.html', documentA.parsedDocument.contents);
        await analyzer.filesChanged(['static/diamond/a.html']);
        result = await analyzer.analyze(initialPaths);

        const root = result.getDocument(initialPaths[1]) as Document;

        const localFeatures = root.getFeatures({imported: false});
        const kinds = Array.from(localFeatures).map((f) => Array.from(f.kinds));
        assert.deepEqual(kinds, [
          ['document', 'html-document'],
          ['import', 'html-import'],
          ['import', 'html-import']
        ]);
      });

      test('all files in a cycle wait for the whole cycle', async() => {
        const loader = new DeterministicUrlLoader();
        const analyzer = new Analyzer({urlLoader: loader});
        const aAnalyzed = analyzer.analyze(['a.html']);
        const bAnalyzed = analyzer.analyze(['b.html']);

        loader.queue.resolve('a.html', `<link rel="import" href="b.html">
            <link rel="import" href="c.html">`);
        loader.queue.resolve('b.html', `<link rel="import" href="a.html">`);

        let cResolved = false;
        // Analysis shouldn't finish without c.html resolving
        const aAnalyzedDone = aAnalyzed.then(() => {
          assert.isTrue(cResolved);
        });
        const bAnalyzedDone = bAnalyzed.then(() => {
          assert.isTrue(cResolved);
        });
        // flush the microtask queue
        await Promise.resolve();
        cResolved = true;
        loader.queue.resolve('c.html', '');
        // wait for the callback above to complete
        await Promise.all([aAnalyzedDone, bAnalyzedDone]);
      });

      test('analyzes multiple imports of the same behavior', async() => {
        const documentA = await analyzer.analyze(
            ['static/multiple-behavior-imports/element-a.html']);
        const documentB = await analyzer.analyze(
            ['static/multiple-behavior-imports/element-b.html']);
        assert.deepEqual(documentA.getWarnings({imported: true}), []);
        assert.deepEqual(documentB.getWarnings({imported: true}), []);
      });

      test(
          'analyzes multiple imports of the same behavior simultaneously',
          async() => {
            const result = await Promise.all([
              analyzer.analyze(
                  ['static/multiple-behavior-imports/element-a.html']),
              analyzer.analyze(
                  ['static/multiple-behavior-imports/element-b.html'])
            ]);
            const documentA = result[0];
            const documentB = result[1];
            assert.deepEqual(documentA.getWarnings({imported: true}), []);
            assert.deepEqual(documentB.getWarnings({imported: true}), []);
          });
    });
  });
});

async function getContext(analyzer: Analyzer) {
  return await analyzer['_analysisComplete'];
};
