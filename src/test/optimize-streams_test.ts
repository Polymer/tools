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
import * as vfs from 'vinyl-fs-fake';
import * as Vinyl from 'vinyl';

import {getOptimizeStreams} from '../optimize-streams';
import {HtmlSplitter} from '../html-splitter';
import {pipeStreams} from '../streams';

suite('optimize-streams', () => {
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
          (file: Vinyl) => fileMap.set(file.path, file.contents.toString()));
      stream.on('end', () => resolve(fileMap));
      stream.on('error', reject);
    });
  }

  test('compile js', async () => {
    const expected = `var apple = 'apple';var banana = 'banana';`;
    const sourceStream = vfs.src([
      {
        path: 'foo.js',
        contents: `const apple = 'apple'; let banana = 'banana';`,
      },
    ]);
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({js: {compile: true}})]);
    assert.equal(await getOnlyFile(op), expected);
  });

  test('does not compile webcomponents.js files (windows)', async () => {
    const es6Contents = `const apple = 'apple';`;
    const sourceStream = vfs.src([
      {
        path:
            'A:\\project\\bower_components\\webcomponentsjs\\webcomponents-es5-loader.js',
        contents: es6Contents,
      },
    ]);
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({js: {compile: true}})]);
    assert.equal(await getOnlyFile(op), es6Contents);
  });

  test('does not compile webcomponents.js files (unix)', async () => {
    const es6Contents = `const apple = 'apple';`;
    const sourceStream = vfs.src([
      {
        path:
            '/project/bower_components/webcomponentsjs/webcomponents-es5-loader.js',
        contents: es6Contents,
      },
    ]);
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({js: {compile: true}})]);
    assert.equal(await getOnlyFile(op), es6Contents);
  });

  suite('rewrites bare module specifiers to paths', () => {
    const fixtureRoot =
        path.join(__dirname, '..', '..', 'test-fixtures', 'npm-modules');

    test('in js files', async () => {
      const filePath = path.join(fixtureRoot, 'foo.js');
      const contents = stripIndent(`
      import { dep1 } from 'dep1';
      import { dep2 } from 'dep2';
      import { dep2A } from 'dep2/a';
      `);
      const expected = stripIndent(`
      import { dep1 } from './node_modules/dep1/index.js';
      import { dep2 } from './node_modules/dep2/dep2.js';
      import { dep2A } from './node_modules/dep2/a.js';
      `);

      const result = await getOnlyFile(pipeStreams([
        vfs.src([{path: filePath, contents}]),
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
          <script type="module">
      import { dep1 } from './node_modules/dep1/index.js';
      import { dep2 } from './node_modules/dep2/dep2.js';
      import { dep2A } from './node_modules/dep2/a.js';</script>
        </head>
        <body>

      </body></html>
      `);

      const htmlSplitter = new HtmlSplitter();
      const result = await getOnlyFile(pipeStreams([
        vfs.src([{path: filePath, contents}]),
        htmlSplitter.split(),
        getOptimizeStreams({js: {moduleResolution: 'node'}}),
        htmlSplitter.rejoin()
      ]));
      assert.deepEqual(result.trim(), expected.trim());
    });
  });

  test('minify js', async () => {
    const sourceStream = vfs.src([
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
    const sourceStream = vfs.src([
      {
        path: 'foo.js',
        contents: '[1,2,3].map(n => n + 1);',
      },
    ]);
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({js: {minify: true}})]);
    assert.equal(await getOnlyFile(op), '[1,2,3].map((a)=>a+1);');
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
      vfs.src(files),
      getOptimizeStreams(opts),
    ]));
    assert.deepEqual([...result.entries()], [...expected.entries()]);
  });

  test('minify html', async () => {
    const expected = `<!doctype html><style>foo {
            background: blue;
          }</style><script>document.registerElement(\'x-foo\', XFoo);</script><x-foo>bar</x-foo>`;
    const sourceStream = vfs.src(
        [
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
        ],
        {cwdbase: true});
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({html: {minify: true}})]);
    assert.equal(await getOnlyFile(op), expected);
  });

  test('minify css', async () => {
    const sourceStream = vfs.src([
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
    const sourceStream = vfs.src(
        [
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
        ],
        {cwdbase: true});
    const op =
        pipeStreams([sourceStream, getOptimizeStreams({css: {minify: true}})]);

    assert.include(await getOnlyFile(op), expected);
  });
});
