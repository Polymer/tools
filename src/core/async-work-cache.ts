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

/**
 * A map from keys to promises of values. Used for caching asynchronous work.
 */
export class AsyncWorkCache<K, V> {
  private _keyToResultMap: Map<K, Promise<V>>;
  constructor(from?: AsyncWorkCache<K, V>) {
    if (from) {
      this._keyToResultMap = new Map(from._keyToResultMap);
    } else {
      this._keyToResultMap = new Map();
    }
  }

  /**
   * If work has already begun to compute the given key, return a promise for
   * the result of that work.
   *
   * If not, compute it with the given function.
   *
   * This method ensures that we will only try to compute the value for `key`
   * once, no matter how often or with what timing getOrCompute is called, even
   * recursively.
   */
  async getOrCompute(key: K, compute: () => Promise<V>) {
    const cachedResult = this._keyToResultMap.get(key);
    if (cachedResult) {
      return cachedResult;
    }
    const promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise is cached before control flow enters compute().
      await Promise.resolve();
      return compute();
    })();
    this._keyToResultMap.set(key, promise);
    return promise;
  }

  get(key: K) {
    return this._keyToResultMap.get(key);
  }

  delete (key: K) {
    this._keyToResultMap.delete(key);
  }

  clear() {
    this._keyToResultMap.clear();
  }

  set(key: K, value: V) {
    this._keyToResultMap.set(key, Promise.resolve(value));
  }

  has(key: K) {
    return this._keyToResultMap.has(key);
  }
}
