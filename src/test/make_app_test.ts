'use strict';

import * as path from 'path';
import {makeApp} from '../make_app';
import {assert} from 'chai';
import * as supertest from 'supertest';

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
