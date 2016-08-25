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

import {assert} from 'chai';

import {TelemetryTracker} from '../../perf/telemetry';

suite('TelemetryTracker', function() {

  test('it can track the performance of synchronous code', async() => {
    const tracker = new TelemetryTracker();
    const doneTracking = tracker.start('test-kind', 'test-id');
    doneTracking();
    const measurements = await tracker.getMeasurements();
    assert.lengthOf(measurements, 1);
    const measurement = measurements[0]!;
    assert.deepEqual(measurement.kind, 'test-kind');
    assert.deepEqual(measurement.identifier, 'test-id');
    assert(measurement.elapsedTime >= 0);
    assert(measurement.elapsedTime <= 10);
  });

  test('it can track the performance of async code.. kinda', async() => {
    const tracker = new TelemetryTracker();
    const promise = new Promise((resolve) => setTimeout(resolve, 0));
    tracker.track(promise, 'test-kind', 'test-id');
    const measurements = await tracker.getMeasurements();
    assert.lengthOf(measurements, 1);
    const measurement = measurements[0]!;
    assert.deepEqual(measurement.kind, 'test-kind');
    assert.deepEqual(measurement.identifier, 'test-id');
    assert(measurement.elapsedTime >= 0);
    assert(measurement.elapsedTime <= 10);
  });

});
