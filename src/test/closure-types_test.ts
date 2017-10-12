/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {assert} from 'chai';

import {closureTypeToTypeScript} from '../closure-types';

suite('closureTypeToTypeScript', () => {

  function check(closureType: string, expectedType: string) {
    const actualType = closureTypeToTypeScript(closureType);
    assert.equal(actualType, expectedType);
  }

  test('primitives', () => {
    check('string', 'string');
    check('boolean', 'boolean');
    check('number', 'number');
  });

  test('nullable primitives', () => {
    check('?string', 'string|null');
    check('?boolean', 'boolean|null');
    check('?string', 'string|null');
  });

  test('all type', () => {
    check('*', 'any');
  });

  test('unknown type', () => {
    check('?', 'any');
  });

  test('null', () => {
    check('null', 'null');
  });

  test('undefined', () => {
    check('undefined', 'undefined');
  });

  test('nullable object', () => {
    check('Object', 'Object|null');
    check('?Object', 'Object|null');
  });

  test('non-nullable object', () => {
    check('!Object', 'Object');
  });

  test('nullable array', () => {
    check('Array<string>', 'string[]|null');
    check('?Array<string>', 'string[]|null');
  });

  test('non-nullable array', () => {
    check('!Array<string>', 'string[]');
  });

  test('union', () => {
    check('string|number', '(string|number)');
  });

  test('paren flattening', () => {
    check('(string)', 'string');
  });

  test('nested array', () => {
    check('!Array<!Array<string>>', 'string[][]');
  });

  test('array union', () => {
    check('!Array<string|number>', '(string|number)[]');
  });

  test('function', () => {
    check('function()', '() => any');

    check(
        'function(string, number): boolean',
        '(p0: string, p1: number) => boolean');
  });
});
