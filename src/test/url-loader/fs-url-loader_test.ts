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

import {FSUrlLoader} from '../../url-loader/fs-url-loader';

suite('FSUrlLoader', function() {
  suite('canLoad', () => {
    test('canLoad is true an in-package URL', () => {
      assert.isTrue(new FSUrlLoader('').canLoad('foo.html'));
    });

    test('canLoad is false for a sibling URL', () => {
      assert.isFalse(new FSUrlLoader('').canLoad('../foo/foo.html'));
    });

    test('canLoad is false for a cousin URL', () => {
      assert.isFalse(new FSUrlLoader('').canLoad('../../foo/foo.html'));
    });

    test('canLoad is false for URL with a hostname', () => {
      assert.isFalse(new FSUrlLoader('').canLoad('http://abc.xyz/foo.html'));
    });
  });

  suite('getFilePath', () => {
    test('resolves an in-package URL', () => {
      assert.equal(new FSUrlLoader('').getFilePath('foo.html'), 'foo.html');
    });

    test('resolves an in-package URL', () => {
      assert.equal(
          new FSUrlLoader('root').getFilePath('foo.html'), 'root/foo.html');
    });

    test('throws for a sibling URL', () => {
      assert.throws(() => new FSUrlLoader('').getFilePath('../foo/foo.html'));
    });

    test('throws for a cousin URL', () => {
      assert.throws(
          () => new FSUrlLoader('').getFilePath('../../foo/foo.html'));
    });

    test('throws for a URL with a hostname', () => {
      assert.throws(
          () => new FSUrlLoader('').getFilePath('http://abc.xyz/foo.html'));
    });
  });
});
