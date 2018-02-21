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

import {CancelToken} from 'cancel-token';
import {assert} from 'chai';

import {AsyncWorkCache} from '../../core/async-work-cache';
import {assertIsCancelled, invertPromise} from '../test-utils';

suite('AsyncWorkCache', () => {
  let cache: AsyncWorkCache<string, string>;
  setup(() => {
    cache = new AsyncWorkCache<string, string>();
  });

  test('it works for the simple happy case', async () => {
    assert.equal(await cache.getOrCompute('key', async () => 'cool'), 'cool');
    // 'cool' was already cached.
    assert.equal(await cache.getOrCompute('key', async () => 'neat'), 'cool');
  });

  test('it handles parallel calls', async () => {
    // Only the first one actually runs
    const promises = [
      cache.getOrCompute('key', async () => 'good'),
      cache.getOrCompute(
          'key',
          async () => {
            throw new Error('Should not be called');
          }),
      cache.getOrCompute(
          'key',
          async () => {
            throw new Error('Should not be called');
          }),
    ];
    assert.deepEqual(await Promise.all(promises), ['good', 'good', 'good']);

    // Errors are cached too
    const failurePromises = [
      cache.getOrCompute(
          'badkey',
          async () => {
            throw 'failed';
          }),
      cache.getOrCompute('badkey', async () => 'good'),
      cache.getOrCompute('badkey', async () => 'good'),
    ].map(invertPromise);
    assert.deepEqual(
        await Promise.all(failurePromises), ['failed', 'failed', 'failed']);
  });

  test('it handles a cancellation followed by a new request', async () => {
    const source = CancelToken.source();
    const promise1 = cache.getOrCompute('key', async () => {
      while (true) {
        await Promise.resolve();
        source.token.throwIfRequested();
      }
    }, source.token);
    source.cancel();
    await assertIsCancelled(promise1);

    const source2 = CancelToken.source();
    const promise2 = cache.getOrCompute('key', async () => {
      await Promise.resolve();
      return 'finished!';
    }, source2.token);
    assert.equal(await promise2, 'finished!');
  });

  const testName = `many parallel calls to getOrCompute, some that cancel,` +
      ` some that don't`;
  test(testName, async () => {
    const cancelledPromises: Promise<string>[] = [];
    for (let i = 0; i < 10; i++) {
      const source = CancelToken.source();
      cancelledPromises.push(cache.getOrCompute('key', async () => {
        while (true) {
          await Promise.resolve();
          source.token.throwIfRequested();
        }
      }, source.token));
      source.cancel();
    }
    assert.equal(await cache.getOrCompute('key', async () => {
      return 'cool';
    }), 'cool');
    for (const cancelled of cancelledPromises) {
      await assertIsCancelled(cancelled);
    }
  });
});
