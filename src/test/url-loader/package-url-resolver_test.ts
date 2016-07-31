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

suite('PackageUrlResolver', function() {

  suite('canResolve', () => {

    test('canResolve is true an in-package URL', () => {
      let r = new PackageUrlResolver();
      assert.isTrue(r.canResolve('foo.html'));
      assert.isTrue(r.canResolve('/foo.html'));
      assert.isTrue(r.canResolve('./foo.html'));
    });

    test('canResolve is true for a sibling URL', () => {
      assert.isTrue(new PackageUrlResolver().canResolve('../foo/foo.html'));
    });

    test('canResolve is false for a cousin URL', () => {
      assert.isFalse(new PackageUrlResolver().canResolve('../../foo/foo.html'));
    });

    test('canResolve is false for URL with a hostname', () => {
      assert.isFalse(
          new PackageUrlResolver().canResolve('http://abc.xyz/foo.html'));
    });

    test('canResolve is true for a URL with the right hostname', () => {
      let r = new PackageUrlResolver({
        hostname: 'abc.xyz',
      });
      assert.isTrue(r.canResolve('http://abc.xyz/foo.html'));
      assert.isTrue(r.canResolve('http://abc.xyz/./foo.html'));
      assert.isTrue(r.canResolve('http://abc.xyz/../foo.html'));
      assert.isTrue(r.canResolve('http://abc.xyz/foo/../foo.html'));
    });

  });

  suite('resolve', () => {

    test('resolves an in-package URL', () => {
      let r = new PackageUrlResolver();
      assert.equal('foo.html', r.resolve('foo.html'));
      assert.equal('foo.html', r.resolve('/foo.html'));
      assert.equal('foo.html', r.resolve('./foo.html'));
    });

    test('resolves a sibling URL', () => {
      assert.equal(
          'bower_components/foo/foo.html',
          new PackageUrlResolver().resolve('../foo/foo.html'));
    });

    test('throws for a cousin URL', () => {
      assert.throws(
          () => new PackageUrlResolver().resolve('../../foo/foo.html'));
    });

    test('throws for a URL with a hostname', () => {
      assert.throws(
          () => new PackageUrlResolver().resolve('http://abc.xyz/foo.html'));
    });

    test('resolves a URL with the right hostname', () => {
      let r = new PackageUrlResolver({
        componentDir: 'components',
        hostname: 'abc.xyz',
      });
      assert.equal('foo.html', r.resolve('http://abc.xyz/foo.html'));
      assert.equal('foo.html', r.resolve('http://abc.xyz/./foo.html'));
      assert.equal('foo.html', r.resolve('http://abc.xyz/../foo.html'));
      assert.equal('foo.html', r.resolve('http://abc.xyz/foo/../foo.html'));

      assert.equal('foo.html', r.resolve('foo.html'));
      assert.equal('foo.html', r.resolve('./foo.html'));
      assert.equal('components/foo/foo.html', r.resolve('../foo/foo.html'));
      assert.equal('foo.html', r.resolve('foo/../foo.html'));

      assert.equal('foo.html', r.resolve('/foo.html'));
      assert.equal('foo.html', r.resolve('/./foo.html'));
      assert.equal('foo/foo.html', r.resolve('/../foo/foo.html'));
      assert.equal('foo.html', r.resolve('/foo/../foo.html'));

    });

  });

});
