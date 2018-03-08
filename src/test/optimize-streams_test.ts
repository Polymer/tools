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

import {getOptimizeStreams} from '../optimize-streams';
import {HtmlSplitter} from '../html-splitter';
import {pipeStreams} from '../streams';

suite('optimize-streams', () => {
  async function testStream(stream: NodeJS.ReadableStream): Promise<any> {
    return new Promise((resolve, reject) => {
      stream.on('data', resolve);
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
    const f = await testStream(op);
    assert.equal(f.contents.toString(), expected);
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
    const f = await testStream(op);
    assert.equal(f.contents.toString(), es6Contents);
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
    const f = await testStream(op);
    assert.equal(f.contents.toString(), es6Contents);
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

      import { p1 } from '/already/a/path.js';
      import { p2 } from './already/a/path.js';
      import { p3 } from '../already/a/path.js';
      import { p4 } from '../already/a/path.js';
      import { p5 } from 'http://example.com/already/a/path.js';
      `);
      const expected = stripIndent(`
      import { dep1 } from './node_modules/dep1/index.js';
      import { dep2 } from './node_modules/dep2/dep2.js';
      import { dep2A } from './node_modules/dep2/a.js';

      import { p1 } from '/already/a/path.js';
      import { p2 } from './already/a/path.js';
      import { p3 } from '../already/a/path.js';
      import { p4 } from '../already/a/path.js';
      import { p5 } from 'http://example.com/already/a/path.js';
      `);

      const result = await testStream(pipeStreams([
        vfs.src([{path: filePath, contents}]),
        getOptimizeStreams({js: {moduleResolution: 'node'}}),
      ]));
      assert.deepEqual(result.contents.toString().trim(), expected.trim());
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
      const result = await testStream(pipeStreams([
        vfs.src([{path: filePath, contents}]),
        htmlSplitter.split(),
        getOptimizeStreams({js: {moduleResolution: 'node'}}),
        htmlSplitter.rejoin()
      ]));
      assert.deepEqual(result.contents.toString().trim(), expected.trim());
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
    const f = await testStream(op);
    assert.equal(f.contents.toString(), 'var foo=3;');
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
    const f = await testStream(op);
    assert.equal(f.contents.toString(), '[1,2,3].map((a)=>a+1);');
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
    const f = await testStream(op);
    assert.equal(f.contents.toString(), expected);
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
    const f = await testStream(op);
    assert.equal(f.contents.toString(), 'selector{property:value;}');
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
    const f = await testStream(op);
    assert.include(f.contents.toString(), expected);
  });
});
