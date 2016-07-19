/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

"use strict";

const assert = require('chai').assert;
const parse5 = require('parse5');

const HtmlScriptFinder = require('../../lib/import/html-script-finder').HtmlScriptFinder;

suite('HtmlScriptFinder', () => {

  suite('findImports()', () => {
    let finder;

    setup(() => {
      finder = new HtmlScriptFinder();
    });

    test('finds external scripts', () => {
      let document = parse5.parse(`<html><head>
          <script src="foo.js"></script>
          <script>console.log('hi')</script>
        </head></html>`)
      let imports = finder.findImports('x-element.html', document);
      assert.equal(imports.length, 1);
      assert.equal(imports[0].type, 'html-script');
      assert.equal(imports[0].url, 'foo.js');
    });

  });

});
