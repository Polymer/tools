/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import * as now from 'performance-now';

export interface Measurement {
  /** The time that the measured operation took, in milliseconds. */
  elapsedTime: number;
  /**
   * A descriptive category for the measured operation, e.g. 'parse' or
   * 'resolve'.
   */
  kind: string;
  /**
   * A helpful identifier for the item that the measured operation was working
   * on. e.g. a url or file path like
   * './bower_components/paper-button/paper-button.html'
   */
  identifier: string;
}

export class TelemetryTracker {
  private _measurements: Measurement[] = [];
  private _promises: Promise<any>[] = [];

  async getMeasurements(): Promise<Measurement[]> {
    await Promise.all(this._promises);
    return this._measurements;
  }

  /**
   * Less useful than it seems, because the time between promise creation and
   * the promise settling isn't just work related to the promise. e.g. if you
   * begin loading a remote file, but then get stuck parsing hydrolysis.js then
   * you're going to be charged both for the loading and the parsing time,
   * because the parsing doesn't get interrupted when the loading completes.
   */
  async track(promise: Promise<any>, kind: string, identifier: string) {
    const track = this._track(promise, kind, identifier);
    this._promises.push(track);
  }

  private async _track(
      promise: Promise<any>, kind: string, identifier: string) {
    const start = now();
    try {
      await promise;
    } catch (_) { /* don't care */
    }
    const elapsed = now() - start;
    this._measurements.push({elapsedTime: elapsed, kind, identifier});
  }

  start(kind: string, identifier: string): () => void {
    let resolve: () => void = () => undefined;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.track(promise, kind, identifier);
    return resolve;
  }
}
