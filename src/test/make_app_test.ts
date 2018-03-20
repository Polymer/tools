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
import * as supertest from 'supertest';

import {makeApp} from '../make_app';

const root = path.join(__dirname, '..', '..', 'test');
const componentDir = path.join(root, 'components');
const packageName = 'polyserve-test';

suite('makeApp', () => {

  test('returns an app', () => {
    let app = makeApp({root, componentDir, packageName});
    assert.isOk(app);
    assert.equal(app.packageName, 'polyserve-test');
  });

  test('serves package files', async () => {
    let app = makeApp({root, componentDir, packageName});
    await supertest(app)
        .get('/polyserve-test/test-file.txt')
        .expect(200, 'PASS\n');
  });

  test('supports relative roots', async () => {
    let app = makeApp({root: './test', componentDir, packageName});
    await supertest(app)
        .get('/polyserve-test/test-file.txt')
        .expect(200, 'PASS\n');
  });

  test('serves component files', async () => {
    let app = makeApp({
      root,
      componentDir: path.join(root, 'bower_components'),
      packageName,
    });
    await supertest(app)
        .get('/test-component/test-file.txt')
        .expect(200, 'TEST COMPONENT\n');
  });

  test('serves component indices', async () => {
    let app = makeApp({
      root,
      componentDir: path.join(root, 'bower_components'),
      packageName,
    });
    await supertest(app).get('/test-component/').expect(200, 'INDEX\n');
  });

  test('redirects directories without trailing slashes', async () => {
    let app = makeApp({
      root,
      componentDir: path.join(root, 'bower_components'),
      packageName,
    });
    await supertest(app)
        .get('/test-component')
        .expect(301)
        .expect('Location', '/test-component/');
  });

  test('serves scoped package files', async () => {
    let app = makeApp({
      root,
      componentDir,
      packageName: '@polymer/polyserve-test',
    });
    await supertest(app)
        .get('/@polymer/polyserve-test/test-file.txt')
        .expect(200, 'PASS\n');
  });

  test('serves scoped component files', async () => {
    let app = makeApp({
      root,
      componentDir: path.join(root, 'npm-package/node_modules'),
      packageName: '@polymer/polyserve-test',
    });
    await supertest(app)
        .get('/@polymer/test-component/test-file.txt')
        .expect(200, 'TEST COMPONENT\n');
  });

});
