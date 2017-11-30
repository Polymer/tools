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

import {ResolvedUrl} from '../../model/url';
import {MultiUrlLoader} from '../../url-loader/multi-url-loader';
import {UrlLoader} from '../../url-loader/url-loader';
import {invertPromise} from '../test-utils';

class MockLoader implements UrlLoader {
  canLoadCount: number;
  loadCount: number;
  constructor(private _load: string|null) {
    this.resetCounts();
  }

  resetCounts() {
    this.canLoadCount = 0;
    this.loadCount = 0;
  }

  canLoad(_url: string): boolean {
    this.canLoadCount++;
    return this._load != null;
  }

  async load(url: string): Promise<string> {
    if (this._load == null) {
      throw new Error(`tried to load ${url} with loader that can\'t load`);
    }
    this.loadCount++;
    return this._load;
  }
}

const mockLoaderArray = (loads: Array<string|null>) =>
    loads.map((load): MockLoader => new MockLoader(load));

suite('MultiUrlLoader', () => {
  suite('canLoad', () => {
    test('canLoad is true if the first loader is true', () => {
      const loaders = mockLoaderArray(['loader 1', null, null]);
      const loader = new MultiUrlLoader(loaders);
      assert.isTrue(loader.canLoad('test.html' as ResolvedUrl));
      // Verify only the first loader is called
      assert.equal(loaders[0].canLoadCount, 1);
      assert.equal(loaders[1].canLoadCount, 0);
      assert.equal(loaders[2].canLoadCount, 0);
    });

    test('canLoad is true if the last loader is true', () => {
      const loaders = mockLoaderArray([null, null, 'loader 3']);
      const loader = new MultiUrlLoader(loaders);
      assert.isTrue(loader.canLoad('test.html' as ResolvedUrl));
      // Verify all loaders are called
      assert.equal(loaders[0].canLoadCount, 1);
      assert.equal(loaders[1].canLoadCount, 1);
      assert.equal(loaders[2].canLoadCount, 1);
    });

    test('canLoad is true if all loaders are true', () => {
      const loaders = mockLoaderArray(['loader 1', 'loader 2', 'loader 3']);
      const loader = new MultiUrlLoader(loaders);
      assert.isTrue(loader.canLoad('test.html' as ResolvedUrl));
      // Verify only the first loader is called
      assert.equal(loaders[0].canLoadCount, 1);
      assert.equal(loaders[1].canLoadCount, 0);
      assert.equal(loaders[2].canLoadCount, 0);
    });

    test('canLoad is false if all loaders are false', () => {
      const loaders = mockLoaderArray([null, null, null]);
      const loader = new MultiUrlLoader(loaders);
      assert.isFalse(loader.canLoad('test.html' as ResolvedUrl));
      // Verify only the first loader is called
      assert.equal(loaders[0].canLoadCount, 1);
      assert.equal(loaders[1].canLoadCount, 1);
      assert.equal(loaders[2].canLoadCount, 1);
    });
  });

  suite('load', () => {
    test('returns only the first loaded file', async () => {
      const loaders = mockLoaderArray(['loader 1', 'loader 2', 'loader 3']);
      const loader = new MultiUrlLoader(loaders);
      assert.equal(await loader.load('test.html' as ResolvedUrl), 'loader 1');
      // Verify only the first loader is called
      assert.equal(loaders[0].canLoadCount, 1);
      assert.equal(loaders[1].canLoadCount, 0);
      assert.equal(loaders[2].canLoadCount, 0);
    });

    test('returns the file from first loader that can load', async () => {
      const loaders = mockLoaderArray([null, null, 'loader 3']);
      const loader = new MultiUrlLoader(loaders);
      assert.equal(await loader.load('test.html' as ResolvedUrl), 'loader 3');
      // Verify only the last load is called
      assert.equal(loaders[0].loadCount, 0);
      assert.equal(loaders[1].loadCount, 0);
      assert.equal(loaders[2].loadCount, 1);
    });

    test('throws an error if no loader can be found to load', async () => {
      const loaders = mockLoaderArray([null, null, null]);
      const loader = new MultiUrlLoader(loaders);
      const error =
          await invertPromise(loader.load('test.html' as ResolvedUrl));
      assert.instanceOf(error, Error);
      assert.include(error.message, 'Unable to load test.html');
      // Verify load is not called on any loader
      assert.equal(loaders[0].loadCount, 0);
      assert.equal(loaders[1].loadCount, 0);
      assert.equal(loaders[2].loadCount, 0);
    });
  });
});
