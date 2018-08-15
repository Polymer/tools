/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {assert} from 'chai';
import * as path from 'path';
import stripIndent = require('strip-indent');
import * as stream from 'stream';
import * as Vinyl from 'vinyl';

import {getOptimizeStreams} from '../optimize-streams';
import {HtmlSplitter} from '../html-splitter';
import {pipeStreams} from '../streams';
import {assertMapEqualIgnoringWhitespace} from './util';

interface FakeFile {
  contents: string;
  path: string;
  cwd?: string;
  base?: string;
}

function createFakeFileStream(files: FakeFile[]) {
  const srcStream = new stream.Readable({objectMode: true});

  srcStream._read = function() {
    for (const file of files) {
      this.push(new Vinyl({
        contents: new Buffer(file.contents),
        cwd: file.cwd,
        base: file.base,
        path: file.path
      }));
    }
    this.push(null);
  };

  return srcStream;
}

suite('optimize-streams', () => {
  const fixtureRoot =
      path.join(__dirname, '..', '..', 'test-fixtures', 'npm-modules');

  async function getOnlyFile(stream: NodeJS.ReadableStream): Promise<string> {
    const fileMap = await getFileMap(stream);
    if (fileMap.size !== 1) {
      throw new Error(`Expected 1 file in the stream, got ${fileMap.size}.`);
    }
    return fileMap.values().next().value;
  }

  async function getFileMap(stream: NodeJS.ReadableStream):
      Promise<Map<string, string>> {
    const fileMap = new Map<string, string>();
    return new Promise<Map<string, string>>((resolve, reject) => {
      stream.on(
          'data',
          (file: Vinyl) => fileMap.set(file.path, file.contents!.toString()));
      stream.on('end', () => resolve(fileMap));
      stream.on('error', reject);
    });
  }

  suite('JS compilation', () => {
    test('compiles to ES5 if compile=true', async () => {
      const expected = `var apple = 'apple';\nvar banana = 'banana';`;
      const sourceStream = createFakeFileStream([
        {
          path: 'foo.js',
          contents: `const apple = 'apple'; let banana = 'banana';`,
        },
      ]);
      const op = pipeStreams(
          [sourceStream, getOptimizeStreams({js: {compile: true}})]);
      assert.equal(await getOnlyFile(op), expected);
    });

    test('compiles ES2017 to ES2015', async () => {
      const sourceStream = createFakeFileStream([
        {
          path: 'foo.js',
          contents: `async function test() { await 0; }`,
        },
      ]);
      const op = pipeStreams(
          [sourceStream, getOptimizeStreams({js: {compile: 'es2015'}})]);
      const result = await getOnlyFile(op);
      assert.include(result, 'asyncToGenerator');
      assert.notInclude(result, 'async function test');
      assert.notInclude(result, 'regeneratorRuntime');
    });

    test('does not compile webcomponents.js files (windows)', async () => {
      const es6Contents = `const apple = 'apple';`;
      const sourceStream = createFakeFileStream([
        {
          path:
              'A:\\project\\bower_components\\webcomponentsjs\\webcomponents-es5-loader.js',
          contents: es6Contents,
        },
      ]);
      const op = pipeStreams(
          [sourceStream, getOptimizeStreams({js: {compile: true}})]);
      assert.equal(await getOnlyFile(op), es6Contents);
    });

    test('does not compile webcomponents.js files (unix)', async () => {
      const es6Contents = `const apple = 'apple';`;
      const sourceStream = createFakeFileStream([
        {
          path:
              '/project/bower_components/webcomponentsjs/webcomponents-es5-loader.js',
          contents: es6Contents,
        },
      ]);
      const op = pipeStreams(
          [sourceStream, getOptimizeStreams({js: {compile: true}})]);
      assert.equal(await getOnlyFile(op), es6Contents);
    });
  });


  suite('rewrites bare module specifiers to paths', () => {
    test('in js files', async () => {
      const filePath = path.join(fixtureRoot, 'foo.js');
      const contents = stripIndent(`
      import { dep1 } from 'dep1';
      import { dep2 } from 'dep2';
      import { dep2A } from 'dep2/a';
      `);
      const expected = stripIndent(`
      import { dep1 } from "./node_modules/dep1/index.js";
      import { dep2 } from "./node_modules/dep2/dep2.js";
      import { dep2A } from "./node_modules/dep2/a.js";
      `);

      const result = await getOnlyFile(pipeStreams([
        createFakeFileStream([{path: filePath, contents}]),
        getOptimizeStreams({js: {moduleResolution: 'node'}}),
      ]));
      assert.deepEqual(result.trim(), expected.trim());
    });

    test('in html inline scripts', async () => {
      const filePath = path.join(fixtureRoot, 'foo.html');
      const contents = stripIndent(`
      <html>
        <head>
          <script type="module">
            import { dep1 } from 'dep1';
            import { dep2 } from 'dep2';
            import { dep2A } from 'dep2/a';
          </script>
        </head>
        <body></body>
      </html>
      `);
      // Note we do some quite ugly re-formatting of HTML!
      const expected = stripIndent(`
      <html><head>
          <script type="module">import { dep1 } from "./node_modules/dep1/index.js";
      import { dep2 } from "./node_modules/dep2/dep2.js";
      import { dep2A } from "./node_modules/dep2/a.js";</script>
        </head>
        <body>

      </body></html>
      `);

      const htmlSplitter = new HtmlSplitter();
      const result = await getOnlyFile(pipeStreams([
        createFakeFileStream([{path: filePath, contents}]),
        htmlSplitter.split(),
        getOptimizeStreams({js: {moduleResolution: 'node'}}),
        htmlSplitter.rejoin()
      ]));
      assert.deepEqual(result.trim(), expected.trim());
    });
  });

  suite('transforms ES modules to AMD', async () => {
    test('inline and external script tags', async () => {
      const files = [
        {
          path: 'index.html',
          contents: `
            <html><head></head><body>
              <script>// not a module</script>
              <script type="module">import { depA } from './depA.js';</script>
              <script type="module" src="./depB.js"></script>
              <script type="module">import { depC } from './depC.js';</script>
            </body></html>
          `,
          expected: `
            <html><head></head><body>
              <script>// not a module</script>
              <script>define(["./depA.js"], function (_depA) {"use strict";});</script>
              <script>define(['./depB.js']);</script>
              <script>define(["./depC.js"], function (_depC) {"use strict";});</script>
            </body></html>
          `,
        },
      ];

      const opts = {
        js: {
          transformModulesToAmd: true,
        },
        rootDir: fixtureRoot,
      };

      const expected = new Map<string, string>(
          files.map((file): [string, string] => [file.path, file.expected]));

      const htmlSplitter = new HtmlSplitter();
      const result = await getFileMap(pipeStreams([
        createFakeFileStream(files),
        htmlSplitter.split(),
        getOptimizeStreams(opts),
        htmlSplitter.rejoin()
      ]));
      assertMapEqualIgnoringWhitespace(result, expected);
    });

    test('auto-detects when to transform external js', async () => {
      const files = [
        {
          path: 'has-import-statement.js',
          contents: `
            import {foo} from './foo.js';
          `,
          expected: `
            define(["./foo.js"], function (_foo) {
              "use strict";
            });
          `,
        },

        {
          path: 'has-export-statement.js',
          contents: `
            export const foo = 'foo';
          `,
          expected: `
            define(["exports"], function (_exports) {
              "use strict";
              Object.defineProperty(_exports, "__esModule", {value: true});
              _exports.foo = void 0;
              const foo = 'foo';
              _exports.foo = foo;
            });
          `,
        },

        {
          path: 'not-a-module.js',
          contents: `
            const foo = 'import export';
          `,
          expected: `
            const foo = 'import export';
          `,
        },
      ];

      const opts = {
        js: {
          transformModulesToAmd: true,
        },
        rootDir: fixtureRoot,
      };

      const expected = new Map<string, string>(
          files.map((file): [string, string] => [file.path, file.expected]));

      const htmlSplitter = new HtmlSplitter();
      const result = await getFileMap(pipeStreams([
        createFakeFileStream(files),
        htmlSplitter.split(),
        getOptimizeStreams(opts),
        htmlSplitter.rejoin()
      ]));
      assertMapEqualIgnoringWhitespace(result, expected);
    });
  });

  test('minify js', async () => {
    const sourceStream = createFakeFileStream([
      {
        path: 'foo.js',
        contents: 'var foo = 3',
      },
    ]);
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({js: {minify: true}})]);

    assert.equal(await getOnlyFile(op), 'var foo=3;');
  });

  test('minify js (es6)', async () => {
    const sourceStream = createFakeFileStream([
      {
        path: 'foo.js',
        contents: '[1,2,3].map(n => n + 1);',
      },
    ]);
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({js: {minify: true}})]);
    assert.equal(await getOnlyFile(op), '[1,2,3].map(n=>n+1);');
  });

  test('js exclude permutations', async () => {
    const files = [
      {
        path: 'minify.js',
        contents: 'const foo = 3;',
        expected: 'const foo=3;',
      },
      {
        path: 'compile.js',
        contents: 'const foo = 3;',
        expected: 'var foo = 3;',
      },
      {
        path: 'minify-compile.js',
        contents: 'const foo = 3;',
        expected: 'var foo=3;',
      },
      {
        path: 'neither.js',
        // Even with no transform plugins, Babel will make minor code formatting
        // changes, such as trimming newlines. This newline remaining shows that
        // Babel did not run at all.
        contents: 'const foo = 3;\n',
        expected: 'const foo = 3;\n',
      },
    ];
    const opts = {
      js: {
        compile: {exclude: ['minify.js', 'neither.js']},
        minify: {exclude: ['compile.js', 'neither.js']},
      },
    };

    const expected = new Map<string, string>(
        files.map((file): [string, string] => [file.path, file.expected]));
    const result = await getFileMap(pipeStreams([
      createFakeFileStream(files),
      getOptimizeStreams(opts),
    ]));
    assert.deepEqual([...result.entries()], [...expected.entries()]);
  });

  test('minify html', async () => {
    const expected = `<!DOCTYPE html><style>foo {
            background: blue;
          }</style><script>document.registerElement(\'x-foo\', XFoo);</script><x-foo>bar</x-foo>`;
    const sourceStream = createFakeFileStream([
      {
        path: 'foo.html',
        contents: `
        <!doctype html>
        <style>
          foo {
            background: blue;
          }
        </style>
        <script>
          document.registerElement('x-foo', XFoo);
        </script>
        <x-foo>
          bar
        </x-foo>
        `,
      },
    ]);
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({html: {minify: true}})]);
    assert.equal(await getOnlyFile(op), expected);
  });

  test('minify css', async () => {
    const sourceStream = createFakeFileStream([
      {
        path: 'foo.css',
        contents: '/* comment */ selector { property: value; }',
      },
    ]);
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({css: {minify: true}})]);
    assert.equal(await getOnlyFile(op), 'selector{property:value;}');
  });

  test('minify css (inlined)', async () => {
    const expected = `<style>foo{background:blue;}</style>`;
    const sourceStream = createFakeFileStream([
      {
        path: 'foo.html',
        contents: `
          <!doctype html>
          <html>
            <head>
              <style>
                foo {
                  background: blue;
                }
              </style>
            </head>
            <body></body>
          </html>
        `,
      },
    ]);
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({css: {minify: true}})]);

    assert.include(await getOnlyFile(op), expected);
  });
});
