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

import {Deferred} from '../utils';

export class PromiseGroup<T> {
  private _closed = false;
  private _pending: number = 0;
  private _failedPromise: Promise<T>|null;
  private _deferred = new Deferred<T[]>();
  private _results = <(T | undefined)[]>[];

  get done() {
    return this._deferred.promise;
  }

  add(promise: Promise<T>): void {
    if (this._failedPromise != null)
      return;
    if (this._closed) {
      throw new Error('PromiseGroup already closed');
    }

    this._pending++;
    const index = this._results.length;
    this._results.push(undefined);
    promise.then(
        (result) => {
          this._results[index] = result;
          if (this._failedPromise != null) {
            return;
          }
          this._pending--;
          if (this._closed && this._pending === 0) {
            this._deferred.resolve(this._results as T[]);
          }
        },
        (error: any) => {
          if (this._failedPromise != null) {
            return;
          }
          this._failedPromise = promise;
          this._deferred.reject(error);
        });
  }

  close() {
    this._closed = true;
    if (this._pending === 0 && !this._deferred.resolved) {
      this._deferred.resolve(this._results as T[]);
    }
  }
}
