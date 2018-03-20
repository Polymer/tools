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
import * as path from 'path';
import Uri from 'vscode-uri';

import {ResolvedUrl} from '../../model/url';
import {FsUrlLoader} from '../../url-loader/fs-url-loader';
import {resolvedUrl} from '../test-utils';

suite('FsUrlLoader', function() {
  suite('canLoad', () => {
    test('canLoad is true for a local file URL inside root', () => {
      assert.isTrue(new FsUrlLoader('/a/').canLoad(
          Uri.file(path.resolve('/a/foo.html')).toString() as ResolvedUrl));
    });

    test('canLoad is false for a local file URL outside root', () => {
      assert.isFalse(new FsUrlLoader('/a/').canLoad(
          Uri.file(path.resolve('/b/foo.html')).toString() as ResolvedUrl));
    });

    test('canLoad is false for a file url with a host', () => {
      assert.isFalse(new FsUrlLoader('/foo/').canLoad(
          resolvedUrl`file://foo/foo/foo.html`));
    });

    test('canLoad is false for a relative path URL', () => {
      assert.isFalse(
          new FsUrlLoader().canLoad(resolvedUrl`../../foo/foo.html`));
    });

    test('canLoad is false for an http URL', () => {
      assert.isFalse(
          new FsUrlLoader().canLoad(resolvedUrl`http://abc.xyz/foo.html`));
    });
  });
});
