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

import {FileRelativeUrl, PackageRelativeUrl, ResolvedUrl} from '../../model/url';
import {MultiUrlResolver} from '../../url-loader/multi-url-resolver';
import {UrlResolver} from '../../url-loader/url-resolver';
import {fileRelativeUrl, packageRelativeUrl, resolvedUrl} from '../test-utils';

class MockResolver extends UrlResolver {
  packageUrl = resolvedUrl``;
  resolveCount: number = 0;
  relativeCount: number = 0;
  constructor(private _resolution: string|null) {
    super();
  }

  resolve(
      firstUrl: ResolvedUrl|PackageRelativeUrl,
      secondUrl?: FileRelativeUrl): ResolvedUrl|undefined {
    const url = secondUrl || firstUrl;
    ++this.resolveCount;
    if (this._resolution && url === this._resolution) {
      return this.brandAsResolved(this._resolution);
    }
    return undefined;
  }

  relative(to: ResolvedUrl): PackageRelativeUrl;
  relative(from: ResolvedUrl, to: ResolvedUrl, kind?: string): FileRelativeUrl;
  relative(fromOrTo: ResolvedUrl, maybeTo?: ResolvedUrl, _kind?: string):
      FileRelativeUrl|PackageRelativeUrl {
    const [from, to] = (maybeTo !== undefined) ? [fromOrTo, maybeTo] :
                                                 [this.packageUrl, fromOrTo];
    ++this.relativeCount;
    const result = this.simpleUrlRelative(from, to);
    if (maybeTo === undefined) {
      return this.brandAsPackageRelative(result);
    }
    return result;
  }
}

const mockResolverArray = (resolutions: Array<string|null>) => {
  return resolutions.map((resolution): MockResolver => {
    return new MockResolver(resolution);
  });
};


suite('MultiUrlResolver', function() {
  suite('resolve', () => {
    test('only the first resolution is returned', () => {
      const resolvers =
          mockResolverArray(['file1.html', 'file2.html', 'file3.html']);
      const resolver = new MultiUrlResolver(resolvers);
      assert.equal(
          resolver.resolve(packageRelativeUrl`file2.html`),
          resolvedUrl`file2.html`);
      // Verify only the first two resolvers are called
      assert.equal(resolvers[0].resolveCount, 1);
      assert.equal(resolvers[1].resolveCount, 1);
      assert.equal(resolvers[2].resolveCount, 0);
    });

    test('keeps trying until it finds a good resolver', () => {
      const resolvers = mockResolverArray([null, null, 'test.html']);
      const resolver = new MultiUrlResolver(resolvers);
      assert.equal(
          resolver.resolve(resolvedUrl``, fileRelativeUrl`test.html`),
          resolvedUrl`test.html`);
      // Verify all resolvers are called
      assert.equal(resolvers[0].resolveCount, 1);
      assert.equal(resolvers[1].resolveCount, 1);
      assert.equal(resolvers[2].resolveCount, 1);
    });

    test(`returns undefined if no resolver works`, () => {
      const resolvers = mockResolverArray([null, null, null]);
      const resolver = new MultiUrlResolver(resolvers);
      assert.equal(
          resolver.resolve(resolvedUrl``, fileRelativeUrl`test.html`),
          undefined);
      // Verify all resolvers are called.
      assert.equal(resolvers[0].resolveCount, 1);
      assert.equal(resolvers[1].resolveCount, 1);
      assert.equal(resolvers[2].resolveCount, 1);
    });
  });

  suite('relative', () => {
    test('delegate the relative function based on resolve', () => {
      const resolvers =
          mockResolverArray(['file1.html', 'file2.html', 'file3.html']);
      const resolver = new MultiUrlResolver(resolvers);
      assert.equal(
          resolver.relative(resolvedUrl`file2.html`),
          packageRelativeUrl`file2.html`);
      // Verify the first two resolvers are called.
      assert.equal(resolvers[0].resolveCount, 1);
      assert.equal(resolvers[1].resolveCount, 1);
      assert.equal(resolvers[2].resolveCount, 0);
      // Verify only the second resolver's `relative` is invoked.
      assert.equal(resolvers[0].relativeCount, 0);
      assert.equal(resolvers[1].relativeCount, 1);
      assert.equal(resolvers[2].relativeCount, 0);
    });
  });
});
