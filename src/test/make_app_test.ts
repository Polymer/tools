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

suite('makeApp', () => {

  test('returns an app', () => {
    let app = makeApp({root});
    assert.isOk(app);
    assert.equal(app.packageName, 'polyserve-test');
  });

  test('serves package files', (done) => {
    let app = makeApp({root});
    const wrappedApp: typeof app = supertest(app) as any;
    wrappedApp.get('/polyserve-test/test-file.txt')
        .expect(200, 'PASS\n')
        .end(done)
  });

  test('serves component files', (done) => {
    let app = makeApp({
      root,
      componentDir: path.join(root, 'bower_components'),
    });
    const wrappedApp: typeof app = supertest(app) as any;
    wrappedApp.get('/test-component/test-file.txt')
        .expect(200, 'TEST COMPONENT\n')
        .end(done)
  });

});
