'use strict';

const makeApp = require('../lib/make_app').makeApp;
const assert = require('chai').assert;
const supertest = require('supertest');

suite('makeApp', () => {

  test('returns an app', () => {
    const app = makeApp({
      root: __dirname,
    });
    assert.isOk(app);
    assert.equal(app.packageName, 'polyserve-test');
  });

  test('serves package files', (done) => {
    const app = makeApp({
      root: __dirname,
    });
    supertest(app)
      .get('/polyserve-test/test-file.txt')
      .expect(200, 'PASS\n')
      .end(done)
  });

  test('serves component files', (done) => {
    const app = makeApp({
      root: __dirname,
      componentDir: __dirname + '/bower_components',
    });
    supertest(app)
      .get('/test-component/test-file.txt')
      .expect(200, 'TEST COMPONENT\n')
      .end(done)
  });

  test('compiles external JS', (done) => {
    const app = makeApp({
      root: __dirname,
      componentDir: __dirname + '/bower_components',
    });
    supertest(app)
      .get('/test-component/test.js')
      .expect((res) => {
        if (res.text.indexOf('class A {}') !== -1) {
          throw new Error('not compiled');
        }
      })
      .end(done)
  });

  test('compiles inline JS', (done) => {
    const app = makeApp({
      root: __dirname,
      componentDir: __dirname + '/bower_components',
    });
    supertest(app)
      .get('/test-component/test.html')
      .expect((res) => {
        if (res.text.indexOf('class A {}') !== -1) {
          throw new Error('not compiled');
        }
      })
      .end(done)
  });

});
