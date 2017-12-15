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

import {PackageUrlResolver} from '../../url-loader/package-url-resolver';
import {fileRelativeUrl, resolvedUrl} from '../test-utils';

suite('PackageUrlResolver', function() {
  suite('resolve', () => {
    test('resolves an in-package URL', () => {
      const r = new PackageUrlResolver();
      assert.equal(
          `foo.html`, r.resolve(fileRelativeUrl`foo.html`, resolvedUrl``));
      assert.equal(
          `foo.html`, r.resolve(fileRelativeUrl`/foo.html`, resolvedUrl``));
      assert.equal(
          `foo.html`, r.resolve(fileRelativeUrl`./foo.html`, resolvedUrl``));
    });

    test(`resolves a sibling URL`, () => {
      assert.equal(
          `bower_components/foo/foo.html`,
          new PackageUrlResolver().resolve(
              fileRelativeUrl`../foo/foo.html`, resolvedUrl``));
    });

    test('returns undefined for a cousin URL', () => {
      assert.equal(
          new PackageUrlResolver().resolve(
              fileRelativeUrl`../../foo/foo.html`, resolvedUrl``),
          undefined);
    });

    test('returns undefined for a URL with a hostname', () => {
      const r = new PackageUrlResolver();
      assert.equal(
          r.resolve(fileRelativeUrl`http://abc.xyz/foo.html`, resolvedUrl``),
          undefined);
      assert.equal(
          r.resolve(fileRelativeUrl`//abc.xyz/foo.html`, resolvedUrl``),
          undefined);
    });

    test(`resolves a URL with the right hostname`, () => {
      const r = new PackageUrlResolver({
        componentDir: `components`,
        hostname: `abc.xyz`,
      });
      assert.equal(
          `foo.html`,
          r.resolve(fileRelativeUrl`http://abc.xyz/foo.html`, resolvedUrl``));
      assert.equal(
          `foo.html`,
          r.resolve(fileRelativeUrl`http://abc.xyz/./foo.html`, resolvedUrl``));
      assert.equal(
          `foo.html`,
          r.resolve(
              fileRelativeUrl`http://abc.xyz/../foo.html`, resolvedUrl``));
      assert.equal(
          `foo.html`,
          r.resolve(
              fileRelativeUrl`http://abc.xyz/foo/../foo.html`, resolvedUrl``));

      assert.equal(
          `foo.html`, r.resolve(fileRelativeUrl`foo.html`, resolvedUrl``));
      assert.equal(
          `foo.html`, r.resolve(fileRelativeUrl`./foo.html`, resolvedUrl``));
      assert.equal(
          `components/foo/foo.html`,
          r.resolve(fileRelativeUrl`../foo/foo.html`, resolvedUrl``));
      assert.equal(
          `foo.html`,
          r.resolve(fileRelativeUrl`foo/../foo.html`, resolvedUrl``));

      assert.equal(
          `foo.html`, r.resolve(fileRelativeUrl`/foo.html`, resolvedUrl``));
      assert.equal(
          `foo.html`, r.resolve(fileRelativeUrl`/./foo.html`, resolvedUrl``));
      assert.equal(
          `foo/foo.html`,
          r.resolve(fileRelativeUrl`/../foo/foo.html`, resolvedUrl``));
      assert.equal(
          `foo.html`,
          r.resolve(fileRelativeUrl`/foo/../foo.html`, resolvedUrl``));
    });

    test(`resolves a URL with spaces`, () => {
      const r = new PackageUrlResolver();
      assert.equal(
          r.resolve(fileRelativeUrl`spaced name.html`, resolvedUrl``),
          resolvedUrl`spaced%20name.html`);
    });

    test('resolves an undecodable URL to undefined', () => {
      const r = new PackageUrlResolver();
      assert.equal(
          r.resolve(fileRelativeUrl`%><><%=`, resolvedUrl``), undefined);
    });
  });
});
