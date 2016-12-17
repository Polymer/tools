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

import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import * as path from 'path';
import * as supertest from 'supertest-as-promised';
import {babelCompileCache} from '../compile-middleware';
import {getApp} from '../start_server';

chai.use(chaiAsPromised);
const assert = chai.assert;
const root = path.join(__dirname, '..', '..', 'test');

suite('compile-middleware', () => {

  suite('babelCompileCache', () => {

    let app: Express.Application;

    const uncompiledHtml =
        fs.readFileSync(
              path.join(root, 'bower_components/test-component/test.html'))
            .toString();
    const uncompiledJs =
        fs.readFileSync(
              path.join(root, 'bower_components/test-component/test.js'))
            .toString();

    beforeEach(() => {
      app = getApp({
        root: root,
        compile: 'always',
        componentDir: path.join(root, 'bower_components'),
      });
      // Ensure a fresh cache for each test.
      babelCompileCache.reset();
    });

    test('caches html compilation results', async() => {
      assert(!babelCompileCache.has(uncompiledHtml));
      const response =
          await supertest(app).get('/components/test-component/test.html');
      assert(babelCompileCache.has(uncompiledHtml));
      assert.equal(response.text, babelCompileCache.get(uncompiledHtml));
      assert.equal(response.text.indexOf('class A {}'), -1, 'Did not compile');
    });

    test('returns cached html compilation results', async() => {
      babelCompileCache.set(uncompiledHtml, 'IM IN UR CACHE');
      const response =
          await supertest(app).get('/components/test-component/test.html');
      assert.equal(response.text, 'IM IN UR CACHE');
    });

    test('caches javascript compilation results', async() => {
      assert(!babelCompileCache.has(uncompiledJs));
      const response =
          await supertest(app).get('/components/test-component/test.js');
      assert(babelCompileCache.has(uncompiledJs));
      assert.equal(response.text, babelCompileCache.get(uncompiledJs));
      assert.equal(response.text.indexOf('class A {}'), -1, 'Did not compile');
    });

    test('returns cached js compilation results', async() => {
      babelCompileCache.set(uncompiledJs, 'IM IN UR CACHE');
      const response =
          await supertest(app).get('/components/test-component/test.js');
      assert.equal(response.text, 'IM IN UR CACHE');
    });

    test('honors the cache max evicting least recently used', async() => {
      await supertest(app).get('/components/test-component/test.html');
      assert(babelCompileCache.has(uncompiledHtml));
      const originalMax = babelCompileCache['max'];
      babelCompileCache['max'] = babelCompileCache.length;
      try {
        await supertest(app).get('/components/test-component/test.js');
        assert(!babelCompileCache.has(uncompiledHtml), 'cached html evicted');
      } finally {
        babelCompileCache['max'] = originalMax;
      }
    });

    test('script tags with invalid javascript are unchanged', async() => {
      const uncompiled =
          fs
              .readFileSync(path.join(
                  root, 'bower_components/compile-test/script-tags.html'))
              .toString();
      assert(!babelCompileCache.has(uncompiled), 'Unexpected entry in cache');
      const response =
          await supertest(app).get('/components/compile-test/script-tags.html');
      assert(babelCompileCache.has(uncompiled), 'Missing cache entry');
      assert.include(response.text, `<script>\nthis is not valid\n</script>`);
      // The valid script tag should still be compiled.
      assert.notInclude(response.text, `<script>\nclass A {}\n</script>`);
    });
  });
});
