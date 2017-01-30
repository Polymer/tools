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
import * as ts from 'typescript';

import stripIndent = require('strip-indent');

import {Analyzer} from '../../analyzer';
import {FSUrlLoader} from '../../url-loader/fs-url-loader';
import {PackageUrlResolver} from '../../url-loader/package-url-resolver';
import {ParsedTypeScriptDocument} from '../../typescript/typescript-document';
import {TypeScriptParser} from '../../typescript/typescript-parser';

suite('TypeScriptParser', () => {
  let parser: TypeScriptParser;

  setup(() => {
    const urlLoader = new FSUrlLoader();
    const urlResolver = new PackageUrlResolver();
    const analyzer = new Analyzer({urlLoader, urlResolver});
    parser = new TypeScriptParser(analyzer);
  });

  suite('parse()', () => {

    test('parses classes', () => {
      const contents = `
        import * as b from './b';

        class Foo extends HTMLElement {
          bar: string = 'baz';
        }
      `;
      const document = parser.parse(contents, '/typescript/test.ts');
      assert.instanceOf(document, ParsedTypeScriptDocument);
      assert.equal(document.url, '/typescript/test.ts');
      const sourceFile = document.ast as ts.SourceFile;

      // very basic check that the file got parsed
      assert.equal(sourceFile.statements.length, 2);
      assert.equal(
          sourceFile.statements[0].kind, ts.SyntaxKind.ImportDeclaration);
    });

    // stringify() not implemented yet
    suite.skip(`stringify()`, () => {
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
});
