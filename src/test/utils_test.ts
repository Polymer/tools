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

/// <reference path="../../node_modules/@types/mocha/index.d.ts" />

import {assert, use} from 'chai';
import {Deferred} from '../utils';

import chaiAsPromised = require('chai-as-promised');
use(chaiAsPromised);

suite('Deferred', () => {

  test('resolves', async() => {
    const deferred = new Deferred<string>();
    const done = assert.becomes(deferred.promise, 'foo');
    deferred.resolve('foo');
    await done;
  });

  test('rejects', async() => {
    const deferred = new Deferred<string>();
    const done = assert.isRejected(deferred.promise, 'foo');
    deferred.reject(new Error('foo'));
    await done;
  });

  test('resolves only once', async() => {
    const deferred = new Deferred<string>();
    deferred.resolve('foo');
    try {
      deferred.resolve('bar');
      assert.fail();
    } catch (e) {
      // pass
    }
    try {
      deferred.reject(new Error('bar'));
      assert.fail();
    } catch (e) {
      // pass
    }
  });

  test('rejects', async() => {
    const deferred = new Deferred<string>();
    deferred.reject(new Error('foo'));
    deferred.promise.catch((_) => {});
    try {
      deferred.resolve('bar');
      assert.fail();
    } catch (e) {
      // pass
    }
    try {
      deferred.reject(new Error('bar'));
      assert.fail();
    } catch (e) {
      // pass
    }
  });

});
