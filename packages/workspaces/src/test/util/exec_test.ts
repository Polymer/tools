/**
 * @license
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
import exec, {checkCommand} from '../../util/exec';

suite('src/util/exec', () => {
  suite('exec()', () => {
    test('returns false if current directory does not exist', async () => {
      const testCwd = process.cwd();
      const result = await exec(testCwd, 'pwd');
      assert.deepEqual(result, {stdout: testCwd, stderr: ''});
    });

    test('passes arguments correctly', async () => {
      const testOutput = 'HELLO THERE';
      const result = await exec('', 'echo', [testOutput]);
      assert.deepEqual(result, {stdout: testOutput, stderr: ''});
    });
  });

  suite('checkCommand()', () => {
    test('returns true if command exists in shell path', async () => {
      assert.isTrue(
          await checkCommand('node'));  // must be true to be running this test
    });

    test('returns false if command does not exist in shell path', async () => {
      assert.isFalse(
          await checkCommand('there-is-no-way-this-exists-ia23t4niaq23n'));
    });
  });
});
