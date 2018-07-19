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

import {closureParamToTypeScript, closureTypeToTypeScript} from '../closure-types';

suite('closureTypeToTypeScript', () => {
  function check(closureType: string, expectedType: string) {
    const actualType = closureTypeToTypeScript(closureType).serialize();
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
    check('Object', 'object|null');
    check('?Object', 'object|null');
  });

  test('non-nullable object', () => {
    check('!object', 'object');
  });

  test('nullable array', () => {
    check('Array<string>', 'string[]|null');
    check('?Array<string>', 'string[]|null');
  });

  test('non-nullable array', () => {
    check('!Array<string>', 'string[]');
  });

  test('bare array', () => {
    check('Array', 'any[]|null');
    check('?Array', 'any[]|null');
    check('!Array', 'any[]');
  });

  test('union', () => {
    check('string|number', 'string|number');
  });

  test('paren edge cases', () => {
    check('(string)', 'string');
    check('((string))', 'string');

    check('(string|number)', 'string|number');
    check('(string)|(number)', 'string|number');
    check('((string)|(number))', 'string|number');

    check('!Array<((string|number))>', 'Array<string|number>');
  });

  test('nested array', () => {
    check('!Array<!Array<string>>', 'Array<string[]>');
  });

  test('array union', () => {
    check('!Array<string|number>', 'Array<string|number>');
  });

  test('function with no params', () => {
    check('function()', '() => any');
    check('!function()', '() => any');
    check('?function()', '(() => any)|null');
    check('function(): void', '() => void');
  });

  test('function with simple params and return', () => {
    check(
        'function(string, number): boolean',
        '(p0: string, p1: number) => boolean');
  });

  test('function with optional param', () => {
    check('function(string=): void', '(p0?: string) => void');
  });

  test('function with rest param', () => {
    check('function(...string): void', '(...p0: string[]) => void');
  });

  test('function object', () => {
    check('Function', 'Function|null');
    check('?Function', 'Function|null');
    check('!Function', 'Function');
  });

  test('constructor', () => {
    check('function(new:HTMLElement)', '{new(): HTMLElement}');
    check(
        'function(new:HTMLElement, string)', '{new(p0: string): HTMLElement}');
  });

  test('record', () => {
    check('{foo:string}', '{foo: string}');
    check('{foo:string, bar:number}', '{foo: string, bar: number}');
    check('{foo, bar}', '{foo: any, bar: any}');
    check('{foo:(string|undefined)}', '{foo?: string}');
  });

  test('returns any when invalid', () => {
    check('><', 'any');
  });

  test('promise', () => {
    check('!Promise<string>', 'Promise<string>');
    check('!Promise', 'Promise<any>');
  });
});

suite('closureParamToTypeScript', () => {
  function check(
      closureType: string,
      expectedType: string,
      expectedOptional: boolean,
      expectedRest: boolean) {
    const actual = closureParamToTypeScript('dummyName', closureType);
    assert.equal(actual.type.serialize(), expectedType);
    assert.equal(actual.optional, expectedOptional);
    assert.equal(actual.rest, expectedRest);
  }

  test('optional string', () => {
    check('string=', 'string', true, false);
  });

  test('required string', () => {
    check('string', 'string', false, false);
  });

  test('optional array', () => {
    check('Array=', 'any[]|null', true, false);
  });

  test('required array', () => {
    check('Array', 'any[]|null', false, false);
  });

  test('invalid required', () => {
    check('><', 'any', false, false);
  });

  test('invalid optional', () => {
    check('><=', 'any', true, false);
  });

  test('rest parameter', () => {
    check('...string', 'string[]', false, true);
    check('...*', 'any[]', false, true);
    check('...Array<string>', 'Array<string[]|null>', false, true);
  });
});
