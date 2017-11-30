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

import * as babel from 'babel-types';
import {assert} from 'chai';
import * as fs from 'fs';
import * as path from 'path';

import stripIndent = require('strip-indent');

import * as esutil from '../../javascript/esutil';
import {JavaScriptDocument} from '../../javascript/javascript-document';
import {JavaScriptParser, JavaScriptModuleParser, JavaScriptScriptParser} from '../../javascript/javascript-parser';
import {ResolvedUrl} from '../../model/url';

suite('JavaScriptParser', () => {
  let parser: JavaScriptParser;

  setup(() => {
    parser = new JavaScriptParser();
  });


  suite('parse()', () => {
    test('parses classes', () => {
      // TODO(usergenic): I had to modify this test fixture because Babylon
      // doesn't appreciate the keyword abuse of `const let = ...`.
      const contents = `
        class Foo extends HTMLElement {
          constructor() {
            super();
            this.bar = () => {};
            const let_ = 'let const';
          }
        }
      `;
      const document =
          parser.parse(contents, '/static/es6-support.js' as ResolvedUrl);
      assert.instanceOf(document, JavaScriptDocument);
      assert.equal(document.url, '/static/es6-support.js');
      assert.equal(document.ast.type, 'Program');
      assert.equal(document.parsedAsSourceType, 'script');
      // First statement is a class declaration
      assert.equal(document.ast.body[0].type, 'ClassDeclaration');
    });

    test('parses async await', () => {
      const contents = `
        async function foo() {
          await Promise.resolve();
        }
      `;
      const document =
          parser.parse(contents, '/static/es6-support.js' as ResolvedUrl);
      assert.instanceOf(document, JavaScriptDocument);
      assert.equal(document.url, '/static/es6-support.js');
      assert.equal(document.ast.type, 'Program');
      assert.equal(document.parsedAsSourceType, 'script');
      // First statement is an async function declaration
      const functionDecl = document.ast.body[0];
      if (!babel.isFunctionDeclaration(functionDecl)) {
        throw new Error('Expected a function declaration.');
      }
      assert.equal(functionDecl.async, true);
    });

    test('throws syntax errors', () => {
      const file = fs.readFileSync(
          path.resolve(__dirname, '../static/js-parse-error.js'), 'utf8');
      assert.throws(
          () => parser.parse(file, '/static/js-parse-error.js' as ResolvedUrl));
    });

    test('attaches comments', () => {
      const file = fs.readFileSync(
          path.resolve(__dirname, '../static/js-elements.js'), 'utf8');
      const document =
          parser.parse(file, '/static/js-elements.js' as ResolvedUrl);
      const ast = document.ast;
      const element1 = ast.body[0];
      const comment = esutil.getAttachedComment(element1)!;
      assert.isTrue(comment.indexOf('test-element') !== -1);
    });

    test('parses an ES module', () => {
      const contents = `
        import foo from 'foo';
      `;
      const document =
          parser.parse(contents, '/static/es6-support.js' as ResolvedUrl);
      assert.instanceOf(document, JavaScriptDocument);
      assert.equal(document.url, '/static/es6-support.js');
      assert.equal(document.ast.type, 'Program');
      assert.equal(document.parsedAsSourceType, 'module');
    });
  });

  suite(`stringify()`, () => {
    test('pretty prints output', () => {
      const contents = stripIndent(`
        class Foo extends HTMLElement {
          constructor() {
            super();

            this.bar = () => {};

            const leet = 'let const';
          }

        }`).trim() +
          '\n';
      const document = parser.parse(contents, 'test-file.js' as ResolvedUrl);
      assert.deepEqual(document.stringify({}), contents);
    });
  });
});

suite('JavaScriptModuleParser', () => {
  let parser: JavaScriptModuleParser;

  setup(() => {
    parser = new JavaScriptModuleParser();
  });

  suite('parse()', () => {
    test('parses an ES6 module', () => {
      const contents = `
    import foo from 'foo';
  `;
      const document =
          parser.parse(contents, '/static/es6-support.js' as ResolvedUrl);
      assert.instanceOf(document, JavaScriptDocument);
      assert.equal(document.url, '/static/es6-support.js');
      assert.equal(document.ast.type, 'Program');
      assert.equal(document.parsedAsSourceType, 'module');
    });
  });
});

suite('JavaScriptScriptParser', () => {
  let parser: JavaScriptScriptParser;

  setup(() => {
    parser = new JavaScriptScriptParser();
  });

  test('throws a syntax error when parsing es6 module', () => {
    const contents = `
      import foo from 'foo';
    `;
    assert.throws(
        () => parser.parse(contents, '/static/es6-support.js' as ResolvedUrl));
  });
});
