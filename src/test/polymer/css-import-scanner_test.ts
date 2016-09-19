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

import {HtmlVisitor} from '../../html/html-document';
import {HtmlParser} from '../../html/html-parser';
import {CssImportScanner} from '../../polymer/css-import-scanner';

suite('CssImportScanner', () => {

  suite('scan()', () => {
    let scanner: CssImportScanner;

    setup(() => {
      scanner = new CssImportScanner();
    });

    test('finds CSS Imports', async() => {
      const contents = `<html><head>
          <link rel="import" href="polymer.html">
          <link rel="import" type="css" href="ignored-outside-dom-module.css">
          <script src="foo.js"></script>
          <link rel="stylesheet" href="foo.css"></link>
        </head>
        <body>
          <dom-module>
            <link rel="import" type="css" href="polymer.css">
            <template>
              <link rel="import" type="css" href="ignored-in-template.css">
            </template>
          </dom-module>
        </body>
        </html>`;
      const document = new HtmlParser().parse(contents, 'test.html');
      const visit = async(visitor: HtmlVisitor) => document.visit([visitor]);

      const features = await scanner.scan(document, visit);
      assert.equal(features.length, 1);
      assert.equal(features[0].type, 'css-import');
      assert.equal(features[0].url, 'polymer.css');
    });

  });

});
