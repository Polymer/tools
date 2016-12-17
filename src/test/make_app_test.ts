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
const componentDir = path.join(root, 'components');

suite('makeApp', () => {

  test('returns an app', () => {
    let app = makeApp({root, componentDir});
    assert.isOk(app);
    assert.equal(app.packageName, 'polyserve-test');
  });

  test('serves package files', async() => {
    let app = makeApp({root, componentDir});
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
    const app = makeApp(
        {root: path.resolve(__dirname, 'no_bower_json/'), componentDir});
    assert.isFalse(called);
    assert.equal(app.packageName, 'no_bower_json');
  });

});
