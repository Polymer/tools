'use strict';

const resolve = require('path').resolve;
const makeApp = require('../lib/make_app').makeApp;
const assert = require('chai').assert;
const supertest = require('supertest');

suite('makeApp', () => {

  var consoleError;

  setup(() => {
    consoleError = console.error;
  });

  teardown(() => {
    console.error = consoleError;
  })

  test('returns an app', () => {
    let app = makeApp({
      root: __dirname,
    });
    assert.isOk(app);
    assert.equal(app.packageName, 'polyserve-test');
  });

  test('shows friendly error when bower.json does not exist', () => {
    let called = false;
    console.error = function(e) {
      called = true;
    }
    let app = makeApp({
      root: resolve(__dirname, 'no_bower_json/')
    });
    assert.isFalse(called);
    assert.equal(app.packageName, 'polyserve');
  });

  test('serves package files', (done) => {
    let app = makeApp({
      root: __dirname,
    });
    supertest(app)
      .get('/polyserve-test/test-file.txt')
      .expect(200, 'PASS\n')
      .end(done)
  });

  test('serves component files', (done) => {
    let app = makeApp({
      root: __dirname,
      componentDir: __dirname + '/bower_components',
    });
    supertest(app)
      .get('/test-component/test-file.txt')
      .expect(200, 'TEST COMPONENT\n')
      .end(done)
  });

});
