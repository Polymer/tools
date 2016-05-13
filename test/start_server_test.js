/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';

const getApp = require('../lib/start_server').getApp;
const assert = require('chai').assert;
const supertest = require('supertest');

suite('startServer', () => {

  test('returns an app', () => {
    let app = getApp({});
    assert.isOk(app);
  });

  test('serves root application files', (done) => {
    let app = getApp({
      root: __dirname,
    });
    supertest(app)
      .get('/test-file.txt')
      .expect(200, 'PASS\n')
      .end(done);
  });

  test('serves component files', (done) => {
    let app = getApp({
      root: __dirname,
    });
    supertest(app)
      .get('/bower_components/test-component/test-file.txt')
      .expect(200, 'TEST COMPONENT\n')
      .end(done);
  });

  test('serves index.html, not 404', (done) => {
    let app = getApp({
      root: __dirname,
    });
    supertest(app)
      .get('/foo')
      .expect(200, 'INDEX\n')
      .end(done);
  });

  test('404s .html files', (done) => {
    let app = getApp({
      root: __dirname,
    });
    supertest(app)
      .get('/foo.html')
      .expect(404)
      .end(done);
  });

});
