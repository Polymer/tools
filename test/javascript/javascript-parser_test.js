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

const JavaScriptParser =
    require('../../lib/javascript/javascript-parser').JavaScriptParser;
const JavaScriptDocument =
    require('../../lib/javascript/javascript-document').JavaScriptDocument;

suite('JavaScriptParser', () => {

  suite('parse()', () => {
    let parser;

    setup(() => {
      parser = new JavaScriptParser({
        findImports(url, document) { return []; },
        parse(type, content, url) { return null; },
      });
    });

    test('parses classes', () => {
      let file = fs.readFileSync(
          path.resolve(__dirname, '../static/es6-support.js'), 'utf8');
      let document = parser.parse(file, '/static/es6-support.js');
      assert.instanceOf(document, JavaScriptDocument);
      assert.equal(document.url, '/static/es6-support.js');
      assert.equal(document.ast.type, 'Program');
      // first statement after "use strict" is a class
      assert.equal(document.ast.body[1].type, 'ClassDeclaration');
    });

    test('throws syntax errors', () => {
      let file = fs.readFileSync(
          path.resolve(__dirname, '../static/js-parse-error.js'), 'utf8');
      assert.throws(() => parser.parse(file, '/static/js-parse-error.js'));
    });

  });

});
