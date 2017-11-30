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

import {PackageRelativeUrl} from '../../model/url';
import {RedirectResolver} from '../../url-loader/redirect-resolver';


suite('RedirectResolver', function() {
  suite('canResolve', () => {
    test('canResolve is true if the prefix matches with protocol', () => {
      const resolver = new RedirectResolver('proto://site/', 'some/path');
      assert.isTrue(resolver.canResolve(
          'proto://site/something.html' as PackageRelativeUrl));
    });

    test('canResolve is true if the prefix matches without protocol', () => {
      const resolver = new RedirectResolver('/site/', 'some/path');
      assert.isTrue(
          resolver.canResolve('/site/something.html' as PackageRelativeUrl));
    });

    test('canResolve is false if the prefix doesn\'t match', () => {
      const resolver = new RedirectResolver('proto://site/', 'some/path');
      assert.isFalse(
          resolver.canResolve('/site/something.html' as PackageRelativeUrl));
      assert.isFalse(resolver.canResolve(
          'protzo://site/something.html' as PackageRelativeUrl));
    });
  });

  suite('resolve', () => {
    test('if prefix matches, url is rewritten', () => {
      const resolver = new RedirectResolver('proto://site/', 'some/path/');
      assert.equal(
          resolver.resolve('proto://site/something.html' as PackageRelativeUrl),
          'some/path/something.html');
    });
    test('if prefix doesn\'t match, resolve throws', () => {
      const resolver = new RedirectResolver('proto://site/', 'some/path/');
      assert.throws(
          () => resolver.resolve(
              'protoz://site/something.html' as PackageRelativeUrl),
          /RedirectResolver/);
    });
  });
});
