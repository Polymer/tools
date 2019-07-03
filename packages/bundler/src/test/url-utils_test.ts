/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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


/// <reference path="../../node_modules/@types/node/index.d.ts" />

import * as chai from 'chai';

import * as urlUtils from '../url-utils';


const assert = chai.assert;


suite('URL Utils', () => {
  suite('stripUrlFileSearchAndHash', () => {
    test('Strips "man.html" basename off URL', () => {
      assert.equal(
          urlUtils.stripUrlFileSearchAndHash('shark://alligator/man.html'),
          'shark://alligator/');
    });

    test('Strips "file.html" basename off URL', () => {
      assert.equal(
          urlUtils.stripUrlFileSearchAndHash(
              'https://example.com/path/to/file.html'),
          'https://example.com/path/to/');
    });

    test('Strips "something?a=b&c=d" basename and search off URL', () => {
      assert.equal(
          urlUtils.stripUrlFileSearchAndHash(
              'https://example.com/path/to/something?a=b&c=d'),
          'https://example.com/path/to/');
    });

    test('Strips "#some-hash-value" off URL', () => {
      assert.equal(
          urlUtils.stripUrlFileSearchAndHash(
              'https://example.com/path/#some-hash-value'),
          'https://example.com/path/');
    });

    test('Handles relative paths', () => {
      assert.equal(
          urlUtils.stripUrlFileSearchAndHash('relative/path/to/file'),
          'relative/path/to/');
    });
  });
});
