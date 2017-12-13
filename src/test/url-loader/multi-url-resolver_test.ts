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
import {MultiUrlResolver} from '../../url-loader/multi-url-resolver';
import {UrlResolver} from '../../url-loader/url-resolver';

class MockResolver extends UrlResolver {
  resolveCount: number = 0;
  constructor(private _resolution: string|null) {
    super();
  }
  resolve(): ResolvedUrl|undefined {
    this.resolveCount++;
    if (this._resolution == null) {
      return undefined;
    }
    return this._resolution as ResolvedUrl;
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
      const resolvers = mockResolverArray(
          ['resolved.html', 'resolved2.html', 'resolved3.html']);
      const resolver = new MultiUrlResolver(resolvers);
      assert.equal(
          resolver.resolve('test.html' as PackageRelativeUrl),
          'resolved.html' as ResolvedUrl);
      // Verify only the first resolver is called
      assert.equal(resolvers[0].resolveCount, 1);
      assert.equal(resolvers[1].resolveCount, 0);
      assert.equal(resolvers[2].resolveCount, 0);
    });

    test('keeps trying until it finds a good resolver', () => {
      const resolvers = mockResolverArray([null, null, 'resolved.html']);
      const resolver = new MultiUrlResolver(resolvers);
      assert.equal(
          resolver.resolve('test.html' as PackageRelativeUrl),
          'resolved.html' as ResolvedUrl);
      // Verify all resolvers are called
      assert.equal(resolvers[0].resolveCount, 1);
      assert.equal(resolvers[1].resolveCount, 1);
      assert.equal(resolvers[2].resolveCount, 1);
    });

    test('only calls the first successful resolver', () => {
      const resolvers = mockResolverArray(
          ['resolved.html', 'resolved2.html', 'resolved3.html']);
      const resolver = new MultiUrlResolver(resolvers);
      assert.equal(
          resolver.resolve('test.html' as PackageRelativeUrl),
          'resolved.html' as ResolvedUrl);
      // Verify only the first resolver is called
      assert.equal(resolvers[0].resolveCount, 1);
      assert.equal(resolvers[1].resolveCount, 0);
      assert.equal(resolvers[2].resolveCount, 0);
    });

    test(`returns undefined if no resolver works`, () => {
      const resolvers = mockResolverArray([null, null, null]);
      const resolver = new MultiUrlResolver(resolvers);
      assert.equal(
          resolver.resolve('test.html' as PackageRelativeUrl), undefined);
      // Verify only the first resolver is called
      assert.equal(resolvers[0].resolveCount, 1);
      assert.equal(resolvers[1].resolveCount, 1);
      assert.equal(resolvers[2].resolveCount, 1);
    });
  });
});
