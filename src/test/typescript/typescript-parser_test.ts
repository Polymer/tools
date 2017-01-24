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
// import * as fs from 'fs';
// import * as path from 'path';
import * as ts from 'typescript';

import stripIndent = require('strip-indent');

import {Analyzer} from '../../analyzer';
import {UrlLoader} from '../../url-loader/url-loader';
// import {FSUrlLoader} from '../../url-loader/fs-url-loader';
import {UrlResolver} from '../../url-loader/url-resolver';
import {ParsedTypeScriptDocument} from '../../typescript/typescript-document';
import {TypeScriptParser} from '../../typescript/typescript-parser';

class TestUrlResolver implements UrlResolver {
  canResolve(url: string) {
    return url === 'test.ts';
  }

  resolve(url: string) {
    return (url === 'test.ts') ? '/typescript/test.ts' : url;
  }
}

class TestUrlLoader implements UrlLoader {
  canLoad(url: string) {
    return url === '/typescript/test.ts';
  }

  load(url: string): Promise<string> {
    if (url === '/typescript/test.ts') {
      return Promise.resolve(`
class A extends HTMLElement {
  foo() { return 'bar'; }
}
`);
    } else {
      throw new Error(`cannot load file ${url}`);
    }
  }
}

suite('TypeScriptParser', () => {
  let parser: TypeScriptParser;

  setup(() => {
    const urlLoader = new TestUrlLoader();
    const urlResolver = new TestUrlResolver();
    const analyzer = new Analyzer({urlLoader, urlResolver});
    parser = new TypeScriptParser(analyzer);
  });

  suite('parse()', () => {

    test('parses classes', () => {
      const contents = `
        import * as b from './b.ts';

        class Foo extends HTMLElement {
          bar: string = 'baz';
        }
      `;
      const document = parser.parse(contents, '/typescript/test.ts');
      assert.instanceOf(document, ParsedTypeScriptDocument);
      assert.equal(document.url, '/typescript/test.ts');
      console.log(document);
      const program = document.program;
      console.log(program.getRootFileNames());
      const emitResult = program.emit();
      const allDiagnostics =
          ts.getPreEmitDiagnostics(program).concat(emitResult.diagnostics);

      if (allDiagnostics) {
        allDiagnostics.forEach((diagnostic) => {
          // const { line, character } =
          // diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
          const message =
              ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n');
          console.log(message);
          // console.log(`${diagnostic.file.fileName}: ${message}`);
        });
      }

      // assert.equal(document.ast.type, 'Program');
      if (emitResult.emitSkipped) {
        console.log('emitSkipped');
      } else if (emitResult.emittedFiles) {
        emitResult.emittedFiles.forEach((file) => {
          console.log(file);
        });
      }
    });

    test.skip('basic compiler host', () => {
      const testSource = `
        class Foo extends HTMLElement {
          bar: string = 'baz';
        }
      `;
      const host: ts.CompilerHost = {
        getSourceFile(
            fileName: string,
            languageVersion: ts.ScriptTarget,
            onError?: (message: string) => void): ts.SourceFile /**/ {
          console.log('getSourceFile', fileName); if (fileName === 'test.ts') {
            return ts.createSourceFile(fileName, testSource, languageVersion);
          } if (onError) onError('not found');
          // tsc's declarations don't support strict null checks
          return null as any as ts.SourceFile;
        },
        getDefaultLibFileName: () => '',
        writeFile: (_fileName, _content) => {},
        getCurrentDirectory: () => ts.sys.getCurrentDirectory(),
        getCanonicalFileName: fileName => ts.sys.useCaseSensitiveFileNames ?
            fileName :
            fileName.toLowerCase(),
        getNewLine: () => ts.sys.newLine,
        useCaseSensitiveFileNames: () => ts.sys.useCaseSensitiveFileNames,
        fileExists: (fileName: string) => fileName === 'test.ts',
        readFile(fileName: string): string /**/ {
          if (fileName === 'test.ts') {
            return testSource;
          } return null as any as string;
        },
        resolveModuleNames(_moduleNames: string[], _containingFile: string):
            ts.ResolvedModule[] /**/ {/**/ throw new Error('unsupported');
                                      /**/},
        getDirectories(_path: string):
            string[] /**/ {/**/ throw new Error('unsupported'); /**/}
      };
      const program = ts.createProgram(['test.ts'], {allowJs: true}, host);
      console.log(program);
    });

    // test('throws syntax errors', () => {
    //   let file = fs.readFileSync(
    //       path.resolve(__dirname, '../static/js-parse-error.js'), 'utf8');
    //   assert.throws(() => parser.parse(file, '/static/js-parse-error.js'));
    // });
    //
    // test('attaches comments', () => {
    //   let file = fs.readFileSync(
    //       path.resolve(__dirname, '../static/js-elements.js'), 'utf8');
    //   let document = parser.parse(file, '/static/js-elements.js');
    //   let ast = document.ast;
    //   let element1 = ast.body[0];
    //   let comment = esutil.getAttachedComment(element1)!;
    //   assert.isTrue(comment.indexOf('test-element') !== -1);
    // });

  });

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
