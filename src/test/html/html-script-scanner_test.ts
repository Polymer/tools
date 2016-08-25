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

import {InlineParsedDocument} from '../../ast/ast';
import {ScannedImport} from '../../ast/import-descriptor';
import {HtmlVisitor} from '../../html/html-document';
import {HtmlParser} from '../../html/html-parser';
import {HtmlScriptScanner} from '../../html/html-script-scanner';

suite('HtmlScriptScanner', () => {

  suite('scan()', () => {
    let scanner: HtmlScriptScanner;

    setup(() => {
      scanner = new HtmlScriptScanner();
    });

    test('finds external and inline scripts', async() => {
      let contents = `<html><head>
          <script src="foo.js"></script>
          <script>console.log('hi')</script>
        </head></html>`;
      const document = new HtmlParser().parse(contents, 'test-document.html');
      let visit = async(visitor: HtmlVisitor) => document.visit([visitor]);

      const features = await scanner.scan(document, visit);
      assert.equal(features.length, 2);
      assert.instanceOf(features[0], ScannedImport);
      const feature0 = <ScannedImport>features[0];
      assert.equal(feature0.type, 'html-script');
      assert.equal(feature0.url, 'foo.js');
      assert.instanceOf(features[1], InlineParsedDocument);
      const feature1 = <InlineParsedDocument>features[1];
      assert.equal(feature1.type, 'js');
      assert.equal(feature1.contents, `console.log('hi')`);
      assert.deepEqual(feature1.locationOffset, {line: 2, col: 19});
    });

  });

});
