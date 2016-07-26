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

"use strict";

const assert = require('chai').assert;
const fs = require('fs');
const path = require('path');

const HtmlParser = require('../../lib/html/html-parser').HtmlParser;

let registry;

suite('HtmlParser', () => {

  suite('parse()', () => {
    let parser;

    setup(() => {
      parser = new HtmlParser({
        findImports(url, document) { return [{type: 'html', url: 'abc'}]; },
        parse(type, content, url) { return null; },
      });
    });

    test('parses a well-formed document', () => {
      let file = fs.readFileSync(
          path.resolve(__dirname, '../static/html-parse-target.html'), 'utf8');
      let document = parser.parse(file, '/static/html-parse-target.html');
      assert.equal(document.url, '/static/html-parse-target.html');
    });

    // enable when parse() or another method parses inline scripts
    test.skip('throws when parsing a malformed document', () => {
      let file = fs.readFileSync(
          path.resolve(__dirname, '../static/malformed.html'), 'utf8');
      assert.throws(() => {
        let document = parser.parse(file, '/static/malformed.html');
        console.log('document', document);
      });
    });

  });

});
