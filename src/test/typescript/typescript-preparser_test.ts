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

import {ParsedTypeScriptDocument} from '../../typescript/typescript-document';
import {TypeScriptPreparser} from '../../typescript/typescript-preparser';
import {WarningCarryingException} from '../../model/model';
import {CodeUnderliner} from '../test-utils';
import {ResolvedUrl} from '../../model/url';

suite('TypeScriptParser', () => {
  let parser: TypeScriptPreparser;

  setup(() => {
    parser = new TypeScriptPreparser();
  });

  suite('parse()', () => {
    test('parses classes', () => {
      const contents = `
        import * as b from './b';

        class Foo extends HTMLElement {
          bar: string = 'baz';
        }
      `;
      const document =
          parser.parse(contents, '/typescript/test.ts' as ResolvedUrl);
      assert.instanceOf(document, ParsedTypeScriptDocument);
      assert.equal(document.url, '/typescript/test.ts');
      const sourceFile = document.ast as ts.SourceFile;

      // very basic check that the file got parsed
      assert.equal(sourceFile.statements.length, 2);
      assert.equal(
          sourceFile.statements[0].kind, ts.SyntaxKind.ImportDeclaration);
    });

    test('throws a WarningCarryingException for parse errors', async () => {
      const contents = 'const const const const const #!@(~~)!();';
      const url = 'ts-parse-error.ts';
      let error: WarningCarryingException|undefined = undefined;
      try {
        parser.parse(contents, url as ResolvedUrl);
      } catch (e) {
        if (!(e instanceof WarningCarryingException)) {
          console.log(e);
          throw new Error('Expected a warning carrying exception.');
        }
        error = e;
      }
      if (error === undefined) {
        throw new Error('Parsing invalid file did not throw!');
      }
      const underliner = CodeUnderliner.withMapping(url, contents);
      assert.deepEqual(await underliner.underline(error.warning), `
const const const const const #!@(~~)!();
      ~~~~~`);
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
        const document = parser.parse(contents, 'test-file.js' as ResolvedUrl);
        assert.deepEqual(document.stringify({}), contents);
      });
    });
  });
});
