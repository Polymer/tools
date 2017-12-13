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

import {PackageRelativeUrl, ResolvedUrl} from '../../model/url';
import {RedirectResolver} from '../../url-loader/redirect-resolver';


suite('RedirectResolver', function() {
  suite('resolve', () => {
    test('if prefix matches, url is rewritten', () => {
      let resolver = new RedirectResolver('proto://site/', 'some/path/');
      assert.equal(
          resolver.resolve('proto://site/something.html' as PackageRelativeUrl),
          'some/path/something.html' as ResolvedUrl);
      resolver = new RedirectResolver('/site/', 'some/path/');
      assert.equal(
          resolver.resolve('/site/something.html' as PackageRelativeUrl),
          'some/path/something.html' as ResolvedUrl);
    });

    test(`if prefix doesn't match, returns undefined`, () => {
      const resolver = new RedirectResolver('proto://site/', 'some/path/');
      assert.equal(
          resolver.resolve(
              'protoz://site/something.html' as PackageRelativeUrl),
          undefined);
    });
  });
});
