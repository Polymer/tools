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
import * as supertest from 'supertest-as-promised';
import {getApp} from '../start_server';

const root = path.join(__dirname, '..', '..', 'test');
const adapterScriptName = 'custom-elements-es5-adapter.js';

suite('custom-elements-es5-adapter-middleware', () => {

  let app: Express.Application;

  beforeEach(() => {
    app = getApp({root, compile: 'always'});
  });

  test('injects into entry point', async() => {
    await supertest(app).get('/').expect(200).expect((res: any) => {
      expect(res.text).to.have.string(adapterScriptName);
    });
  });

  test('does not inject into non entry point', async() => {
    await supertest(app)
        .get('/components/test-component/test.html')
        .expect(200)
        .expect((res: any) => {
          expect(res.text).to.not.string(adapterScriptName);
        });
  });
});
