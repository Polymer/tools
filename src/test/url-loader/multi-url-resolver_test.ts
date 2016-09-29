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

import {MultiUrlResolver} from '../../url-loader/multi-url-resolver';
import {UrlResolver} from '../../url-loader/url-resolver';

class MockResolver implements UrlResolver {
  canResolveCount: number;
  resolveCount: number;
  constructor(private _resolution: string|null) {
    this.resetCounts();
  }

  resetCounts() {
    this.canResolveCount = 0;
    this.resolveCount = 0;
  }
  canResolve(): boolean {
    this.canResolveCount++;
    return this._resolution != null;
  }
  resolve(): string {
    if (this._resolution == null) {
      throw new Error('tried to resolve to a null resolution!');
    }
    this.resolveCount++;
    return this._resolution;
  }
}

const mockResolverArray = (resolutions: Array<string|null>) => {
  return resolutions.map((resolution): MockResolver => {
    return new MockResolver(resolution);
  });
};


suite('MultiUrlResolver', function() {

  suite('canResolve', () => {

    test('canResolve is true if the first resolver is true', () => {
      let resolvers = mockResolverArray(['resolved.html', null, null]);
      let resolver = new MultiUrlResolver(resolvers);
      assert.isTrue(resolver.canResolve('test.html'));
      // Verify only the first resolver is called
      assert.equal(resolvers[0].canResolveCount, 1);
      assert.equal(resolvers[1].canResolveCount, 0);
      assert.equal(resolvers[2].canResolveCount, 0);
    });

    test('canResolve is true if the last resolver is true', () => {
      let resolvers = mockResolverArray([null, null, 'resolved.html']);
      let resolver = new MultiUrlResolver(resolvers);
      assert.isTrue(resolver.canResolve('test.html'));
      // Verify all resolvers are called
      assert.equal(resolvers[0].canResolveCount, 1);
      assert.equal(resolvers[1].canResolveCount, 1);
      assert.equal(resolvers[2].canResolveCount, 1);
    });

    test('canResolve is true if all resolvers are true', () => {
      let resolvers = mockResolverArray(
          ['resolved.html', 'resolved2.html', 'resolved3.html']);
      let resolver = new MultiUrlResolver(resolvers);
      assert.isTrue(resolver.canResolve('test.html'));
      // Verify only the first resolver is called
      assert.equal(resolvers[0].canResolveCount, 1);
      assert.equal(resolvers[1].canResolveCount, 0);
      assert.equal(resolvers[2].canResolveCount, 0);
    });

    test('canResolve is false if all resolvers are false', () => {
      let resolvers = mockResolverArray([null, null, null]);
      let resolver = new MultiUrlResolver(resolvers);
      assert.isFalse(resolver.canResolve('test.html'));
      // Verify only the first resolver is called
      assert.equal(resolvers[0].canResolveCount, 1);
      assert.equal(resolvers[1].canResolveCount, 1);
      assert.equal(resolvers[2].canResolveCount, 1);
    });

  });

  suite('resolve', () => {
    test('only the first resolution is returned', () => {
      let resolvers = mockResolverArray(
          ['resolved.html', 'resolved2.html', 'resolved3.html']);
      let resolver = new MultiUrlResolver(resolvers);
      assert.equal(resolver.resolve('test.html'), 'resolved.html');
      // Verify only the first resolver is called
      assert.equal(resolvers[0].canResolveCount, 1);
      assert.equal(resolvers[1].canResolveCount, 0);
      assert.equal(resolvers[2].canResolveCount, 0);
    });
  });
});
