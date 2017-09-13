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

import {expect} from 'chai';
import * as path from 'path';
import * as supertest from 'supertest';
import {getApp} from '../start_server';

const root = path.join(__dirname, '..', '..', 'test');
const adapterScriptName = 'custom-elements-es5-adapter.js';

suite('custom-elements-es5-adapter-middleware', () => {

  test('injects into entry point', async () => {
    const app = getApp({root, compile: 'always'});
    await supertest(app).get('/').expect(200).expect((res: any) => {
      expect(res.text).to.have.string(adapterScriptName);
    });
  });

  test('does not inject into non entry point', async () => {
    const app = getApp({root, compile: 'always'});
    await supertest(app)
        .get('/components/test-component/test.html')
        .expect(200)
        .expect((res: any) => {
          expect(res.text).to.not.have.string(adapterScriptName);
        });
  });

  test('only injects when ES5 compilation is required', async () => {
    // Chrome 48 doesn't support ES2015.
    const chrome48 =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/48.0.3163.31 Safari/537.36';
    const app = getApp({root});
    await supertest(app)
        .get('/')
        .set('User-Agent', chrome48)
        .expect(200)
        .expect((res: any) => {
          expect(res.text).to.have.string(adapterScriptName);
        });

    // Chrome 60 supports ES2015, but not modules. Regression test for
    // https://github.com/Polymer/polyserve/issues/217 where lack of modules
    // support would incorrectly cause injection of the ES5 adapter.
    const chrome60 =
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.31 Safari/537.36';
    await supertest(app)
        .get('/')
        .set('User-Agent', chrome60)
        .expect(200)
        .expect((res: any) => {
          expect(res.text).to.not.have.string(adapterScriptName);
        });
  });
});
