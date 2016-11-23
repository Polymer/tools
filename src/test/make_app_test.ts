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
import * as path from 'path';
import * as supertest from 'supertest-as-promised';

import {makeApp} from '../make_app';

const root = path.join(__dirname, '..', '..', 'test');

suite('makeApp', () => {

  test('returns an app', () => {
    let app = makeApp({root});
    assert.isOk(app);
    assert.equal(app.packageName, 'polyserve-test');
  });

  test('serves package files', async() => {
    let app = makeApp({root});
    await supertest(app)
        .get('/polyserve-test/test-file.txt')
        .expect(200, 'PASS\n');
  });

  test('serves component files', async() => {
    let app = makeApp({
      root,
      componentDir: path.join(root, 'bower_components'),
    });
    await supertest(app)
        .get('/test-component/test-file.txt')
        .expect(200, 'TEST COMPONENT\n');
  });

  test('shows friendly error when bower.json does not exist', () => {
    let called = false;
    console.error = function(_e: any) {
      called = true;
    };
    const app = makeApp({root: path.resolve(__dirname, 'no_bower_json/')});
    assert.isFalse(called);
    assert.equal(app.packageName, 'no_bower_json');
  });

  suite('compilation', () => {

    const testCompilation = (options: {
      url: string,
      agent?: string,
      compile: 'always' | 'never' | 'auto',
      result: 'compiled' | 'uncompiled'
    }) => async() => {
      const url = options.url;
      const agent = options.agent;
      const compile = options.compile;
      const result = options.result;
      const app = makeApp({
        root: root,
        componentDir: path.join(root, 'bower_components'), compile,
      });
      let request = supertest(app).get(url);
      if (agent) {
        request = request.set('User-Agent', agent)
      }
      const response = await request;
      const isCompiled = response.text.indexOf('class A {}') === -1;
      const shouldCompile = result === 'compiled';
      if (isCompiled && !shouldCompile) {
        throw new Error('Source was compiled');
      } else if (!isCompiled && shouldCompile) {
        throw new Error('Source was not compiled');
      }
    };

    test('compiles external JS when --compile=always', testCompilation({
           url: '/test-component/test.js',
           compile: 'always',
           result: 'compiled',
         }));

    test('compiles inline JS when --compile=always', testCompilation({
           url: '/test-component/test.html',
           compile: 'always',
           result: 'compiled',
         }));

    test('doesn\'t compile external JS when --compile=never', testCompilation({
           url: '/test-component/test.js',
           compile: 'never',
           result: 'uncompiled',
         }));

    test('doesn\'t compile inline JS when --compile=never', testCompilation({
           url: '/test-component/test.html',
           compile: 'never',
           result: 'uncompiled',
         }));

    test(
        'doesn\'t compile external JS when --compile=auto and agent is Chrome',
        testCompilation({
          url: '/test-component/test.js',
          agent:
              'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.52 Safari/537.36',
          compile: 'auto',
          result: 'uncompiled',
        }));

    test(
        'compiles external JS when --compile=auto and agent is unknown',
        testCompilation({
          url: '/test-component/test.js',
          compile: 'auto',
          result: 'compiled',
        }));
  });

});
