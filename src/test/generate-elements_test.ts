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

import {LocationOffset} from '../ast/ast';
import {SourceLocation} from '../elements-format';
import {correctSourceLocation} from '../generate-elements';


// See analysis_test for tests of generateElementMetadata

suite('correctSourceLocation', function() {
  test('handles undefined gracefully', function() {
    const zeroSourceLocation: SourceLocation = {line: 0, column: 0};
    const zeroLocationOffset: LocationOffset = {line: 0, col: 0};

    assert.equal(undefined, correctSourceLocation(undefined, undefined));
    assert.equal(
        undefined, correctSourceLocation(undefined, zeroLocationOffset));
    assert.deepEqual(
        zeroSourceLocation,
        correctSourceLocation(zeroSourceLocation, undefined));
  });
  test('handles source locations on the first line', function() {
    assert.deepEqual(
        {line: 1, column: 2},
        correctSourceLocation({line: 0, column: 1}, {line: 1, col: 1}));
  });
  test(
      'does not change column offsets for ' +
          'source locations after the first',
      function() {
        assert.deepEqual(
            {line: 2, column: 1},
            correctSourceLocation({line: 1, column: 1}, {line: 1, col: 1}));
      });

  test('does not modify its input', function() {
    const input: SourceLocation = {line: 5, column: 5};
    const offset: LocationOffset = {line: 5, col: 5};
    const expected: SourceLocation = {line: 10, column: 5};
    assert.deepEqual(expected, correctSourceLocation(input, offset));
    assert.deepEqual({line: 5, column: 5}, input);
  });
});
