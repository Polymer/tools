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
import * as fs from 'fs';
import * as path from 'path';
import stripIndent = require('strip-indent');

import * as esutil from '../../javascript/esutil';
import {JavaScriptDocument} from '../../javascript/javascript-document';
import {JavaScriptParser} from '../../javascript/javascript-parser';

suite('JavaScriptParser', () => {
  let parser: JavaScriptParser;

  setup(() => {
    parser = new JavaScriptParser({sourceType: 'script'});
  });


  suite('parse()', () => {

    test('parses classes', () => {
      let contents = `
        class Foo extends HTMLElement {
          constructor() {
            super();
            this.bar = () => {};
            const let = 'let const';
          }
        }
      `;
      let document = parser.parse(contents, '/static/es6-support.js');
      assert.instanceOf(document, JavaScriptDocument);
      assert.equal(document.url, '/static/es6-support.js');
      assert.equal(document.ast.type, 'Program');
      // First statement is a class declaration
      assert.equal(document.ast.body[0].type, 'ClassDeclaration');
    });

    test('throws syntax errors', () => {
      let file = fs.readFileSync(
          path.resolve(__dirname, '../static/js-parse-error.js'), 'utf8');
      assert.throws(() => parser.parse(file, '/static/js-parse-error.js'));
    });

    test('attaches comments', () => {
      let file = fs.readFileSync(
          path.resolve(__dirname, '../static/js-elements.js'), 'utf8');
      let document = parser.parse(file, '/static/js-elements.js');
      let ast = document.ast;
      let element1 = ast.body[0];
      let comment = esutil.getAttachedComment(element1)!;
      assert.isTrue(comment.indexOf('test-element') !== -1);
    });

  });

  suite(`stringify()`, () => {
    test('pretty prints output', () => {
      const contents = stripIndent(`
        class Foo extends HTMLElement {
          constructor() {
            super();
            this.bar = () => {
            };
            const let = 'let const';
          }
        }`).trim() +
          '\n';
      const document = parser.parse(contents, 'test-file.js');
      assert.deepEqual(document.stringify({}), contents);
    });
  });
});
