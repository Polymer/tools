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

import * as babel from 'babel-types';
import {assert} from 'chai';

import {objectKeyToString} from '../../javascript/esutil';


// See analysis_test for tests of generateElementMetadata

suite('objectKeyToString', function() {
  test('produces expected type names', function() {
    const start = 0;
    const end = 0;
    const loc = {start: {line: 0, column: 0}, end: {line: 0, column: 0}};
    const memberExpression: babel.MemberExpression = {
      type: 'MemberExpression',
      object: {
        type: 'Identifier',
        name: 'foo',
        loc,
        start,
        end,
      },
      property: {
        type: 'Identifier',
        name: 'bar',
        loc,
        start,
        end,
      },
      computed: false,
      loc,
      start,
      end,
    };
    const afe: babel.ArrowFunctionExpression = {
      id: {type: 'Identifier', name: 'foo', loc, start, end},
      type: 'ArrowFunctionExpression',
      expression: true,
      generator: false,
      async: false,
      params: [],
      body: {
        type: 'Identifier',
        name: 'foo',
        loc,
        start,
        end,
      },
      loc,
      start,
      end,
    };
    const inputToOutput:
        [
          babel.Identifier|babel.StringLiteral|babel.NumericLiteral|
          babel.MemberExpression|babel.ArrowFunctionExpression,
          string|undefined
        ][] =
            [
              [{type: 'Identifier', name: 'foo', loc, start, end}, 'foo'],
              [
                {
                  type: 'StringLiteral',
                  value: 'foo',
                  loc,
                  start,
                  end,
                  /* raw: '"foo"' */
                },
                'foo'
              ],
              [
                {
                  type: 'NumericLiteral',
                  value: 10,
                  loc,
                  start,
                  end,
                  /* raw: '10' */
                },
                '10'
              ],
              [memberExpression, 'foo.bar'],
              // When it hits an unknown type it returns undefined
              [afe, undefined]
            ];
    for (const testCase of inputToOutput) {
      assert.equal(testCase[1], objectKeyToString(testCase[0]));
    }
  });
});
