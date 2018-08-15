/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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
import {parseDependencyMappingInput} from '../../../cli/util';


suite('src/cli/util', () => {
  suite('parseDependencyMappingInput()', () => {
    test(
        'throws an error when more than 3 comma-seperated values are passed',
        () => {
          assert.throws(() => parseDependencyMappingInput(''));
          assert.throws(() => parseDependencyMappingInput('bad-input'));
          assert.throws(() => parseDependencyMappingInput('bad,bad'));
          assert.throws(() => parseDependencyMappingInput('bad,bad,bad,bad'));
        });

    test('properly parses three comma-seperated values', () => {
      assert.deepEqual(parseDependencyMappingInput('a,b,c'), ['a', 'b', 'c']);
      assert.deepEqual(
          parseDependencyMappingInput('a-a,b-b,^c.c.c'),
          ['a-a', 'b-b', '^c.c.c']);
      assert.deepEqual(
          parseDependencyMappingInput('a.js,b.js,~c.c.c'),
          ['a.js', 'b.js', '~c.c.c']);
      assert.deepEqual(
          parseDependencyMappingInput(
              'hello-I-am-some_long_weirdPACKAGEname,hello-I-am-some_long_weirdPACKAGEname,^0.0.0-pre.11'),
          [
            'hello-I-am-some_long_weirdPACKAGEname',
            'hello-I-am-some_long_weirdPACKAGEname',
            '^0.0.0-pre.11'
          ]);
    });
  });
});
