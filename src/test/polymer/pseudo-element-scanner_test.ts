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
import {ResolvedUrl} from '../../model/url';
import {PseudoElementScanner} from '../../polymer/pseudo-element-scanner';

suite('PseudoElementScanner', () => {
  suite('scan()', () => {
    let scanner: PseudoElementScanner;

    setup(() => {
      scanner = new PseudoElementScanner();
    });

    test('finds pseudo elements in html comments ', async () => {
      const desc = `This is a pseudo element`;
      const contents = `<html><head></head><body>
          <!--
          ${desc}
          @pseudoElement x-foo
          @demo demo/index.html
          -->
        </body>
        </html>`;
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);

      const {features} = await scanner.scan(document, visit);
      assert.equal(features.length, 1);
      assert.equal(features[0].tagName, 'x-foo');
      assert(features[0].pseudo);
      assert.equal(features[0].description.trim(), desc);
      assert.deepEqual(
          features[0].demos, [{desc: 'demo', path: 'demo/index.html'}]);
    });
  });
});
