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

import {RedirectResolver} from '../../url-loader/redirect-resolver';
import {packageRelativeUrl, resolvedUrl} from '../test-utils';


suite('RedirectResolver', function() {
  suite('resolve', () => {
    test('if prefix matches, url is rewritten', () => {
      let resolver =
          new RedirectResolver(resolvedUrl``, 'proto://site/', 'some/path/');
      assert.equal(
          resolver.resolve(packageRelativeUrl`proto://site/something.html`),
          resolvedUrl`some/path/something.html`);
      resolver = new RedirectResolver(resolvedUrl``, '/site/', 'some/path/');
      assert.equal(
          resolver.resolve(packageRelativeUrl`/site/something.html`),
          resolvedUrl`some/path/something.html`);
    });

    test(`if prefix doesn't match, returns undefined`, () => {
      const resolver =
          new RedirectResolver(resolvedUrl``, 'proto://site/', 'some/path/');
      assert.equal(
          resolver.resolve(packageRelativeUrl`protoz://site/something.html`),
          undefined);
    });

    test(`if url matches redirection target, returns url`, () => {
      const resolver =
          new RedirectResolver(resolvedUrl`/a/`, 'proto://site/', '/b/');
      const resolved =
          resolver.resolve(packageRelativeUrl`proto://site/page.html`)!;
      assert.equal(resolved, resolvedUrl`/b/page.html`);
      assert.equal(resolver.resolve(resolved), resolved);
    });
  });

  suite('relative', () => {
    test('if `to` is not in redirect-to, return as-is', () => {
      const resolver = new RedirectResolver(
          resolvedUrl`file:///src/a/`,
          resolvedUrl`proto://site/`,
          resolvedUrl`file:///src/b/`);
      const relative = resolver.relative(resolvedUrl`file:///src/a/page.html`)!;
      assert.equal(relative, packageRelativeUrl`page.html`);
      assert.equal(
          resolver.relative(resolvedUrl`file:///src/a/page.html`),
          packageRelativeUrl`page.html`);
    });

    test('if `from` is not in redirect-to, un-redirect the `to`', () => {
      const resolver = new RedirectResolver(
          resolvedUrl`file:///src/a/`,
          resolvedUrl`proto://site/`,
          resolvedUrl`file:///src/b/`);
      const relative = resolver.relative(resolvedUrl`file:///src/b/page.html`)!;
      assert.equal(relative, packageRelativeUrl`proto://site/page.html`);
      assert.equal(
          resolver.relative(resolvedUrl`proto://site/page.html`),
          packageRelativeUrl`proto://site/page.html`);
    });
  });
});
