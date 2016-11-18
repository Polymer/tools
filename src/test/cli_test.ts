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
import {run as cliRun} from '../cli';

suite('cli', () => {

  test('unknown cmd parameter should not throw exception', () => {
    const originalArgv = process.argv;
    process.argv = ['node', 'polyserve', '--unknown-parameter'];

    try {
      return cliRun();
    } finally {
      // restore process arguments for other readers
      process.argv = originalArgv;
    }
  });

});
