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
import {makeApp} from '../make_app';

chai.use(chaiAsPromised);
const assert = chai.assert;
const root = path.join(__dirname, '..', '..', 'test');

suite('compile-middleware', () => {

  suite('babelCompileCache', () => {
    test('caches html compilation results', async() => {
      const app =
          makeApp({root, compile: 'always', componentDir: 'bower_components'});

      // We'll make this request three times
      const request = () => supertest(app).get('/test-component/test.html');

      // This is the uncompiled source.  The cache uses this as the key.
      const uncompiledHtml =
          fs.readFileSync(
                path.join(root, 'bower_components/test-component/test.html'))
              .toString();

      // Response of initial request
      const responseAfterCompile = await request();

      // Expect the output to be compiled
      assert.equal(
          responseAfterCompile.text.indexOf('class A {}'),
          -1,
          'Did not compile');

      // Expect the compiled output to be in the cache, keyed by the uncompiled
      // source html.
      assert.equal(
          responseAfterCompile.text, babelCompileCache.get(uncompiledHtml));

      // Set the cached value to something else.
      babelCompileCache.set(uncompiledHtml, 'IM IN UR CACHE');

      // Make the request again, this time expect the value in cache as result.
      const responseFromCache = await request();
      assert.equal(responseFromCache.text, 'IM IN UR CACHE');

      // Evict the cached value to max length exceeded.
      const originalCacheMax = babelCompileCache['max'];
      babelCompileCache['max'] = 60;
      babelCompileCache.set(
          'this is a fairly long entry', 'it will push out the LRU entry');
      babelCompileCache['max'] = originalCacheMax;
      assert.equal(babelCompileCache.has(uncompiledHtml), false);

      // Request again and expect the output to match the original compiled
      // response.
      const responseFromCacheMiss = await request();
      assert.equal(responseFromCacheMiss.text, responseAfterCompile.text);
    });

    test('caches javascript compilation results', async() => {
      const app =
          makeApp({root, compile: 'always', componentDir: 'bower_components'});

      // We'll make this request three times
      const request = () => supertest(app).get('/test-component/test.js');

      // This is the uncompiled source.  The cache uses this as the key.
      const uncompiledJs =
          fs.readFileSync(
                path.join(root, 'bower_components/test-component/test.js'))
              .toString();

      // Response of initial request
      const responseAfterCompile = await request();

      // Expect the output to be compiled
      assert.equal(
          responseAfterCompile.text.indexOf('class A {}'),
          -1,
          'Did not compile');

      // Expect the compiled output to be in the cache, keyed by the uncompiled
      // source javascript.
      assert.equal(
          responseAfterCompile.text, babelCompileCache.get(uncompiledJs));

      // Set the cached value to something else.
      babelCompileCache.set(uncompiledJs, 'IM IN UR CACHE');

      // Make the request again, this time expect the value in cache as result.
      const responseFromCache = await request();
      assert.equal(responseFromCache.text, 'IM IN UR CACHE');

      // Evict the cached value to max length exceeded.
      const originalCacheMax = babelCompileCache['max'];
      babelCompileCache['max'] = 60;
      babelCompileCache.set(
          'this is a fairly long entry', 'it will push out the LRU entry');
      babelCompileCache['max'] = originalCacheMax;
      assert.equal(babelCompileCache.has(uncompiledJs), false);

      // Request again and expect the output to match the original compiled
      // response.
      const responseFromCacheMiss = await request();
      assert.equal(responseFromCacheMiss.text, responseAfterCompile.text);
    });
  });
});
