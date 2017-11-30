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

import {correctPosition, correctSourceRange, LocationOffset, SourcePosition, SourceRange} from '../../model/model';


suite('correctSourceRange', function() {
  test('handles undefined gracefully', function() {
    const zeroPosition = {line: 0, column: 0};
    const zeroSourceRange:
        SourceRange = {file: 'foo', start: zeroPosition, end: zeroPosition};
    const zeroLocationOffset: LocationOffset = {line: 0, col: 0};

    assert.equal(correctSourceRange(undefined, undefined), undefined);
    assert.equal(correctSourceRange(undefined, zeroLocationOffset), undefined);
    assert.deepEqual(
        correctSourceRange(zeroSourceRange, undefined), zeroSourceRange);
  });
  test('handles source locations on the first line', function() {
    assert.deepEqual(
        correctPosition({line: 0, column: 1}, {line: 1, col: 1}),
        {line: 1, column: 2});
  });
  test(
      'does not change column offsets for ' +
          'source locations after the first',
      function() {
        assert.deepEqual(
            correctPosition({line: 1, column: 1}, {line: 1, col: 1}),
            {line: 2, column: 1},
        );
      });

  test('does not modify its input', function() {
    const input: SourcePosition = {line: 5, column: 5};
    const offset: LocationOffset = {line: 5, col: 5};
    const expected: SourcePosition = {line: 10, column: 5};
    assert.deepEqual(correctPosition(input, offset), expected);
    assert.deepEqual(input, {line: 5, column: 5});
  });
});
