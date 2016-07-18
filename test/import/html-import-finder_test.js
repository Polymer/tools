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
const fs = require('fs');
const path = require('path');
const parse5 = require('parse5');

const HtmlImportFinder = require('../../lib/import/html-import-finder').HtmlImportFinder;

suite('HtmlImportFinder', () => {

  suite('findImports()', () => {
    let finder;

    setup(() => {
      finder = new HtmlImportFinder();
    });

    test('finds HTML Imports', () => {
      let document = parse5.parse(`<html><head>
          <link rel="import" href="../foo/foo.html">
          <link rel="prefetch import" href="../bar/bar.html">
        </head></html>`)
      let imports = finder.findImports('x-element.html', document);
      assert.equal(imports.length, 2);
      assert.equal(imports[0].type, 'html');
      assert.equal(imports[0].url, '../foo/foo.html');
    });

  });

});
