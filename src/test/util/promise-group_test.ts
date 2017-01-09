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

/// <reference path="../../../node_modules/@types/mocha/index.d.ts" />

import {assert, use} from 'chai';

import {PromiseGroup} from '../../util/promise-group';
import {Deferred} from '../../utils';

import chaiAsPromised = require('chai-as-promised');
use(chaiAsPromised);

suite('PromiseGroup', () => {

  let group: PromiseGroup<any>;

  setup(() => {
    group = new PromiseGroup<any>();
  });

  test('does not resolve spontaneously', async() => {
    let resolved = false;
    group.done.then(() => resolved = true);
    // wait for the microtask queue to empty
    await Promise.resolve();
    assert.isFalse(resolved);
  });

  test('resolves with no promises', async() => {
    const done = assert.becomes(group.done, []);
    group.close();
    await done;
  });

  test('resolves with a resolved promise', async() => {
    group.add(Promise.resolve('foo'));
    const done = assert.becomes(group.done, ['foo']);
    group.close();
    await done;
  });

  test('resolves when added promises resolve', async() => {
    const deferred1 = new Deferred<string>();
    const deferred2 = new Deferred<string>();
    group.add(deferred1.promise);
    group.add(deferred2.promise);
    const done = assert.becomes(group.done, ['foo', 'bar']);
    group.close();
    deferred1.resolve('foo');
    deferred2.resolve('bar');
    await done;
  });

  test('resolves when some promises resolved before close', async() => {
    const deferred1 = new Deferred<string>();
    group.add(deferred1.promise);
    deferred1.resolve('foo');

    const deferred2 = new Deferred<string>();
    group.add(deferred2.promise);
    const done = assert.becomes(group.done, ['foo', 'bar']);
    group.close();
    deferred2.resolve('bar');
    await done;
  });

  test('rejects with an already rejected promise', async() => {
    const done = assert.isRejected(group.done, 'foo');
    group.add(Promise.reject(new Error('foo')));
    await done;
  });

  test('rejects with first rejected promise', async() => {
    const deferred1 = new Deferred<string>();
    const deferred2 = new Deferred<string>();
    group.add(deferred1.promise);
    group.add(deferred2.promise);
    const done = assert.isRejected(group.done, 'bar');
    group.close();
    deferred2.reject(new Error('bar'));
    deferred1.reject(new Error('foo'));
    await done;
  });

});
