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
import * as path from 'path';

import {Analyzer} from '../../core/analyzer';
import {HtmlVisitor} from '../../html/html-document';
import {HtmlParser} from '../../html/html-parser';
import {HtmlScriptScanner} from '../../html/html-script-scanner';
import {JavaScriptDocument} from '../../javascript/javascript-document';
import {Analysis} from '../../model/analysis';
import {ScannedImport, ScannedInlineDocument} from '../../model/model';
import {ResolvedUrl} from '../../model/url';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';

const fixturesDir = path.resolve(__dirname, '../static');
suite('HtmlScriptScanner', () => {
  suite('scan()', () => {
    let scanner: HtmlScriptScanner;

    setup(() => {
      scanner = new HtmlScriptScanner();
    });

    test('finds external and inline scripts', async () => {
      const contents = `<html><head>
          <script src="foo.js"></script>
          <script>console.log('hi')</script>
        </head></html>`;
      const document =
          new HtmlParser().parse(contents, 'test-document.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);

      const {features} = await scanner.scan(document, visit);
      assert.equal(features.length, 2);
      assert.instanceOf(features[0], ScannedImport);
      const feature0 = features[0] as ScannedImport;
      assert.equal(feature0.type, 'html-script');
      assert.equal(feature0.url, 'foo.js');
      assert.instanceOf(features[1], ScannedInlineDocument);
      const feature1 = features[1] as ScannedInlineDocument;
      assert.equal(feature1.type, 'js');
      assert.equal(feature1.contents, `console.log('hi')`);
      assert.deepEqual(feature1.locationOffset, {line: 2, col: 18});
    });

    test('finds external scripts relative to baseUrl', async () => {
      const contents = `<html><head><base href="/aybabtu/">
          <script src="foo.js"></script>
        </head></html>`;
      const document =
          new HtmlParser().parse(contents, 'test-document.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);

      const {features} = await scanner.scan(document, visit);
      assert.equal(features.length, 1);
      assert.instanceOf(features[0], ScannedImport);
      const feature0 = features[0] as ScannedImport;
      assert.equal(feature0.type, 'html-script');
      assert.equal(feature0.url, '/aybabtu/foo.js');
    });

    suite('modules', () => {
      const urlLoader = new FSUrlLoader(fixturesDir);
      const analyzer = new Analyzer({urlLoader});
      let analysis: Analysis;

      before(async () => {
        analysis = await analyzer.analyze(['js-modules.html']);
      });

      test('finds external module scripts', () => {
        const htmlScripts = [...analysis.getFeatures({kind: 'html-script'})];
        assert.equal(htmlScripts.length, 1);
        const js = htmlScripts[0].document.parsedDocument as JavaScriptDocument;
        assert.equal(js.url, 'javascript/module.js');
        assert.equal(js.parsedAsSourceType, 'module');
        assert.equal(
            js.contents.trim(), `import * as submodule from './submodule.js';`);
      });

      test('finds inline module scripts', () => {
        const inlineDocuments =
            [...analysis.getFeatures({kind: 'inline-document'})];
        assert.equal(inlineDocuments.length, 1);
        const js = inlineDocuments[0].parsedDocument as JavaScriptDocument;
        assert.equal(js.url, 'js-modules.html');
        assert.equal(js.parsedAsSourceType, 'module');
        assert.equal(
            js.contents.trim(),
            `import * as something from './javascript/module-with-export.js';`);
      });

      test('follows import statements in modules', async () => {
        const jsImports = [...analysis.getFeatures({kind: 'js-import'})];
        assert.equal(jsImports.length, 2);

        // import statement in inline module script in 'js-modules.html'
        const js0 = jsImports[0].document.parsedDocument as JavaScriptDocument;
        assert.equal(js0.url, 'javascript/module-with-export.js');
        assert.equal(js0.parsedAsSourceType, 'module');
        assert.equal(
            js0.contents.trim(), `export const someValue = 'value goes here';`);

        // import statement in external module script 'javascript/module.js'
        const js1 = jsImports[1].document.parsedDocument as JavaScriptDocument;
        assert.equal(js1.url, 'javascript/submodule.js');
        assert.equal(js1.parsedAsSourceType, 'module');
        assert.equal(
            js1.contents.trim(), `export const subThing = 'sub-thing';`);
      });
    });
  });
});
