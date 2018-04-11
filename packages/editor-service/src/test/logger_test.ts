/**
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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
import {readFileSync} from 'fs';
import {join} from 'path';

import {createTestEnvironment, delay} from './util';

suite('Logger', () => {

  test('will log to a file when asked to', async() => {
    const {client, baseDir} = await createTestEnvironment();
    const logFile = join(baseDir, 'pes.log');
    await client.changeConfiguration({logToFile: logFile});
    await delay(100);
    assert.match(
        readFileSync(logFile, 'utf-8'),
        /^\n\n\n\n\nInitialized with workspace path:/);
    await client.cleanup();
  });

});
