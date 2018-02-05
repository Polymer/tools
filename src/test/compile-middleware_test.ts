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
import * as supertest from 'supertest';

import {babelCompileCache, getCompileCacheKey, isPolyfill} from '../compile-middleware';
import {getApp} from '../start_server';

chai.use(chaiAsPromised);
const assert = chai.assert;
const root = path.join(__dirname, '..', '..', 'test');

const userAgentsThatDontSupportES2015OrModules = [
  'unknown browser',
  'Mozilla/5.0 (iPhone; CPU iPhone OS 9_1 like Mac OS X) AppleWebKit/601.1.46 (KHTML, like Gecko) Version/9.0 Mobile/13B143 Safari/601.1',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/14.99999',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.14986',
];

const chrome61UA =
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.39 Safari/537.36';

const userAgentsThatSupportES2015AndModules = [
  chrome61UA,
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8',
];

function readTestFile(p: string) {
  return fs.readFileSync(path.join(root, p)).toString();
}

suite('compile-middleware', () => {

  let app: Express.Application;

  suite('babelCompileCache', () => {
    const uncompiledHtml =
        readTestFile('bower_components/test-component/test.html');
    const uncompiledJs =
        readTestFile('bower_components/test-component/test.js');
    const options = {transformES2015: true, transformModules: true};

    setup(() => {
      app = getApp({
        root: root,
        compile: 'always',
        componentDir: path.join(root, 'bower_components'),
      });
      // Ensure a fresh cache for each test.
      babelCompileCache.reset();
    });

    test('caches html compilation results', async () => {
      const requestPath = '/components/test-component/test.html';
      const cacheKey = getCompileCacheKey(requestPath, uncompiledHtml, options);
      assert.isFalse(babelCompileCache.has(cacheKey));
      const response = await supertest(app).get(requestPath).expect(200);
      assert.isTrue(babelCompileCache.has(cacheKey));
      assert.equal(response.text, babelCompileCache.get(cacheKey));
      assert.equal(response.text.indexOf('class A {}'), -1, 'Did not compile');
    });

    test('returns cached html compilation results', async () => {
      const requestPath = '/components/test-component/test.html';
      const cacheKey = getCompileCacheKey(requestPath, uncompiledHtml, options);
      babelCompileCache.set(cacheKey, 'IM IN UR CACHE');
      const response = await supertest(app).get(requestPath);
      assert.equal(response.text, 'IM IN UR CACHE');
    });

    test('caches javascript compilation results', async () => {
      const requestPath = '/components/test-component/test.js';
      const cacheKey = getCompileCacheKey(requestPath, uncompiledJs, options);
      assert.isFalse(babelCompileCache.has(cacheKey));
      const response = await supertest(app).get(requestPath);
      assert.isTrue(babelCompileCache.has(cacheKey));
      assert.equal(response.text, babelCompileCache.get(cacheKey));
      assert.equal(response.text.indexOf('class A {}'), -1, 'Did not compile');
    });

    test('returns cached js compilation results', async () => {
      const requestPath = '/components/test-component/test.js';
      const cacheKey = getCompileCacheKey(requestPath, uncompiledJs, options);
      babelCompileCache.set(cacheKey, 'IM IN UR CACHE');
      const response = await supertest(app).get(requestPath);
      assert.equal(response.text, 'IM IN UR CACHE');
    });

    test('honors the cache max evicting least recently used', async () => {
      const requestPath = '/components/test-component/test.html';
      const cacheKey = getCompileCacheKey(requestPath, uncompiledHtml, options);
      await supertest(app).get(requestPath);
      assert.isTrue(babelCompileCache.has(cacheKey));
      const originalMax = babelCompileCache['max'];
      babelCompileCache['max'] = babelCompileCache.length;
      try {
        // request a file not in the cache
        await supertest(app).get('/components/test-component/test.js');
        assert.isFalse(babelCompileCache.has(cacheKey), 'cached html evicted');
      } finally {
        babelCompileCache['max'] = originalMax;
      }
    });

    test('script tags with invalid javascript are unchanged', async () => {
      const filePath =
          path.join(root, 'bower_components/compile-test/script-tags.html');
      const requestPath = '/components/compile-test/script-tags.html';
      const uncompiled = fs.readFileSync(filePath).toString();
      const cacheKey = getCompileCacheKey(requestPath, uncompiled, options);
      assert.isFalse(
          babelCompileCache.has(cacheKey), 'Unexpected entry in cache');

      const response = await supertest(app).get(requestPath);
      assert(babelCompileCache.has(cacheKey), 'Missing cache entry');
      assert.include(response.text, `<script>\nthis is not valid\n</script>`);
      // The valid script tag should still be compiled.
      assert.notInclude(response.text, `<script>\nclass A {}\n</script>`);
    });

    suite('with compile option set to \'auto\'', () => {

      setup(() => {
        app = getApp({
          root: root,
          compile: 'auto',
          componentDir: path.join(root, 'bower_components'),
        });
        // Ensure a fresh cache for each test.
        babelCompileCache.reset();
      });

      test('detect user-agents that do not need compilation', async () => {
        const requestPath = '/components/test-component/test.js';
        const cacheKey = getCompileCacheKey(requestPath, uncompiledJs, options);
        assert.isFalse(
            babelCompileCache.has(cacheKey), `Unexpected .js file in cache`);
        for (const userAgent of userAgentsThatSupportES2015AndModules) {
          const response = await supertest(app)
                               .get('/components/test-component/test.js')
                               .set('User-Agent', userAgent);
          assert.isFalse(
              babelCompileCache.has(cacheKey),
              `Unexpected .js file in cache User-Agent ${userAgent}`);
          assert.include(
              response.text,
              'class A {}',
              `Unexpected compilation for User-Agent ${userAgent}`);
          babelCompileCache.reset();
        }
      });

      test('detect user-agents that need compilation', async () => {
        const requestPath = '/components/test-component/test.js';
        const cacheKey = getCompileCacheKey(requestPath, uncompiledJs, options);
        assert.isFalse(
            babelCompileCache.has(cacheKey), `Unexpected .js file in cache`);
        for (const userAgent of userAgentsThatDontSupportES2015OrModules) {
          const response = await supertest(app)
                               .get('/components/test-component/test.js')
                               .set('User-Agent', userAgent);
          assert.isTrue(
              babelCompileCache.has(cacheKey),
              `Expected .js file in cache User-Agent ${userAgent}`);
          assert.notInclude(
              response.text,
              'class A {}',
              `Expected compilation for User-Agent ${userAgent}`);
          babelCompileCache.reset();
        }
      });
    });
  });

  test('isPolyfill', () => {
    assert.isTrue(
        isPolyfill.test('/webcomponentsjs/custom-elements-es5-adapter.js'));
    assert.isTrue(isPolyfill.test('/webcomponentsjs/webcomponents-lite.js'));
    assert.isTrue(isPolyfill.test(
        '/bower_components/webcomponentsjs/webcomponents-lite.js'));

    assert.isFalse(isPolyfill.test('/webcomponentsjs/tests/ce-import.html'));
    assert.isFalse(
        isPolyfill.test('/webcomponentsjs/tests/imports/current-script.js'));
    assert.isFalse(
        isPolyfill.test('/notwebcomponentsjs/webcomponents-lite.js'));
  });

  suite('module transformations', () => {
    // Chrome 60 supports ES2015 but not modules.
    const userAgent =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3163.39 Safari/537.36';

    setup(() => {
      app = getApp({
        root: root,
        compile: 'auto',
        componentDir: path.join(root, 'bower_components'),
      });
      babelCompileCache.reset();
    });

    async function assertGolden(filename: string) {
      const golden = readTestFile(
          path.join('bower_components', 'test-modules', 'golden', filename));
      const response = await supertest(app)
                           .get('/components/test-modules/' + filename)
                           .set('User-Agent', userAgent);
      assert.equal(response.text.trim(), golden.trim());
    }

    test('transforms HTML with WCT', async () => {
      await assertGolden('test-suite-wct.html');
    });

    test('transforms HTML without WCT', async () => {
      await assertGolden('test-suite-no-wct.html');
    });

    test('does not transform HTML when nomodule script exists', async () => {
      await assertGolden('test-suite-nomodule.html');
    });

    test('transforms module-looking JS', async () => {
      await assertGolden('lib-module.js');
    });

    test('transforms non-module-looking JS', async () => {
      await assertGolden('lib-no-module.js');
    });

    test('serves RequireJS library', async () => {
      const response =
          await supertest(app).get('/components/requirejs/require.js');
      assert.equal(response.status, 200);
      assert.include(response.text, 'requirejs');
    });

  });

  suite('module transformations', () => {
    const userAgent = chrome61UA;

    setup(() => {
      app = getApp({
        root: root,
        compile: 'never',
        moduleResolution: 'node',
        componentDir: path.join(root, 'node_modules'),
      });
      babelCompileCache.reset();
    });

    async function assertGolden(
        filename: string, componentRequest: boolean, index = false) {
      let filePath = path.join('node_modules/golden', filename);
      if (index) {
        filePath = path.join(filePath, 'index.html');
      }
      const golden = readTestFile(filePath);
      const response =
          await supertest(app)
              .get(
                  path.join((componentRequest ? '/components/' : ''), filename))
              .set('User-Agent', userAgent);
      assert.equal(response.text.trim(), golden.trim());
    }

    test('rewrites bare specifiers in component requests', async () => {
      await assertGolden('@polymer/test-component/test-module.js', true);
    });

    test('rewrites bare specifiers in HTML in component requests', async () => {
      await assertGolden('@polymer/test-component/index.html', true);
    });

    test(
        'rewrites bare specifiers in index.html in component requests',
        async () => {
          await assertGolden('@polymer/test-component/', true, true);
        });

    test('rewrites bare specifiers in app requests', async () => {
      await assertGolden('/app.js', false);
    });

  });

});
