/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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
import {PrefixedUrlLoader} from '../../url-loader/prefixed-url-loader';
import {UrlLoader} from '../../url-loader/url-loader';
import {invertPromise} from '../test-utils';

class MockLoader implements UrlLoader {
  canLoadUrls: string[];
  loadUrls: string[];
  constructor(private _load: string|null) {
    this.reset();
  }

  reset() {
    this.canLoadUrls = [];
    this.loadUrls = [];
  }

  canLoad(url: string): boolean {
    this.canLoadUrls.push(url);
    return this._load != null;
  }

  async load(url: string): Promise<string> {
    this.loadUrls.push(url);
    if (this._load == null) {
      throw new Error(`Tried to load "${url}", and delegate can't load it.`);
    }
    return this._load;
  }
}

suite('PrefixedUrlLoader', () => {
  suite('canLoad', () => {
    test('canLoad is true if the url starts with prefix', () => {
      const delegate = new MockLoader('stuff');
      const loader = new PrefixedUrlLoader('path/to/stuff/', delegate);
      assert.isTrue(loader.canLoad('path/to/stuff/file.html' as ResolvedUrl));
      // Delegate receives an unprefixed url to check.
      assert.deepEqual(delegate.canLoadUrls, ['file.html']);
    });

    test('canLoad is false if the url does not start with prefix', () => {
      const delegate = new MockLoader('stuff');
      const loader = new PrefixedUrlLoader('path/to/stuff/', delegate);
      assert.isFalse(loader.canLoad('path/to/other/file.html' as ResolvedUrl));
      // Delegate is not consulted.
      assert.deepEqual(delegate.canLoadUrls, []);
    });

    test('canLoad is false if the delgate loader says it is', () => {
      const delegate = new MockLoader(null);
      const loader = new PrefixedUrlLoader('path/to/stuff/', delegate);
      assert.isFalse(loader.canLoad('path/to/stuff/file.html' as ResolvedUrl));
      // Delegate receives an unprefixed url to check.
      assert.deepEqual(delegate.canLoadUrls, ['file.html']);
    });
  });

  suite('load', () => {
    test('load returns content if url starts with prefix', async () => {
      const delegate = new MockLoader('stuff');
      const loader = new PrefixedUrlLoader('path/to/stuff/', delegate);
      assert.deepEqual(
          await loader.load('path/to/stuff/file.html' as ResolvedUrl), 'stuff');
      // Delegate receives an unprefixed url to load.
      assert.deepEqual(delegate.loadUrls, ['file.html']);
    });

    test('load throws error if url does not start with prefix', async () => {
      const delegate = new MockLoader('stuff');
      const loader = new PrefixedUrlLoader('path/to/stuff/', delegate);
      const error = await invertPromise(
          loader.load('path/to/other/file.html' as ResolvedUrl));
      assert.instanceOf(error, Error);
      assert.deepEqual(
          error.message,
          'Can not load "path/to/other/file.html", does not match prefix "path/to/stuff/".');
      // Delegate is not consulted.
      assert.deepEqual(delegate.loadUrls, []);
    });

    test(
        'load passes on delegate error if url starts with prefix', async () => {
          const delegate = new MockLoader(null);
          const loader = new PrefixedUrlLoader('path/to/stuff/', delegate);
          const error = await invertPromise(
              loader.load('path/to/stuff/file.html' as ResolvedUrl));
          assert.instanceOf(error, Error);
          assert.deepEqual(
              error.message,
              'Tried to load "file.html", and delegate can\'t load it.');
          // Delegate was asked.
          assert.deepEqual(delegate.loadUrls, ['file.html']);
        });
  });
});
