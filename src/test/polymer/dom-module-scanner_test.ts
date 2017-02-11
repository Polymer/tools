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
import {DomModuleScanner} from '../../polymer/dom-module-scanner';

suite('DomModuleScanner', () => {

  suite('scan()', () => {
    let scanner: DomModuleScanner;

    setup(() => {
      scanner = new DomModuleScanner();
    });

    test('finds local IDs', async() => {
      const contents = `<html><head></head>
        <body>
          <dom-module>
            <template>
              <div id="foo"></div>
              <span id="bar"></div>
              <div id2="nope"></div>
            </template>
          </dom-module>
        </body>
        </html>`;
      const document = new HtmlParser().parse(contents, 'test.html');
      const visit = async(visitor: HtmlVisitor) => document.visit([visitor]);

      const domModules = await scanner.scan(document, visit);
      assert.equal(domModules.length, 1);
      assert.equal(domModules[0].localIds.length, 2);
      assert.equal(domModules[0].localIds[0].name, 'foo');
      assert.equal(domModules[0].localIds[1].name, 'bar');
    });

  });

});
