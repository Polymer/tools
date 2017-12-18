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
import {resolvedUrl} from '../test-utils';

suite('FSUrlLoader', function() {
  suite('canLoad', () => {
    test('canLoad is true a local file URL', () => {
      assert.isTrue(new FSUrlLoader().canLoad(resolvedUrl`file:///foo.html`));
    });

    test('canLoad is false for a file url with a host', () => {
      assert.isFalse(
          new FSUrlLoader().canLoad(resolvedUrl`file://foo/foo/foo.html`));
    });

    test('canLoad is false for a relative path URL', () => {
      assert.isFalse(
          new FSUrlLoader().canLoad(resolvedUrl`../../foo/foo.html`));
    });

    test('canLoad is false for an http URL', () => {
      assert.isFalse(
          new FSUrlLoader().canLoad(resolvedUrl`http://abc.xyz/foo.html`));
    });
  });
});
