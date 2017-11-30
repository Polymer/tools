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

/// <reference path="../../../node_modules/@types/mocha/index.d.ts" />

import {assert, use} from 'chai';
import {Url} from 'url';

import {Deferred, parseUrl} from '../../core/utils';

import chaiAsPromised = require('chai-as-promised');
import {invertPromise} from '../test-utils';
use(chaiAsPromised);

suite('parseUrl', () => {
  function testUrl(url: string, properties: Partial<Url>) {
    const urlObject = parseUrl(url);
    for (const strKey of Object.keys(properties)) {
      const key = strKey as keyof Url;
      assert.equal(urlObject[key], properties[key], `${url} property ${key}`);
    }
  }

  test('parses urls that are absolute paths', () => {
    testUrl(
        '/abs/path',
        {protocol: undefined, hostname: undefined, pathname: '/abs/path'});
    testUrl('/abs/path?query=string#hash', {
      protocol: undefined,
      hostname: undefined,
      pathname: '/abs/path',
      hash: '#hash',
      search: '?query=string',
    });
  });

  test('parses urls without protocol', () => {
    testUrl('//host/path', {
      protocol: undefined,
      hostname: 'host',
      pathname: '/path',
    });
    testUrl('//host', {
      protocol: undefined,
      hostname: 'host',
      pathname: undefined,
    });
  });

  test('parses urls that have protocols', () => {
    testUrl('https://host/path', {
      protocol: 'https:',
      hostname: 'host',
      pathname: '/path',
    });
  });
});

suite('Deferred', () => {
  test('resolves', async () => {
    const deferred = new Deferred<string>();
    deferred.resolve('foo');
    assert.deepEqual(await deferred.promise, 'foo');
  });

  test('rejects', async () => {
    const deferred = new Deferred<string>();
    deferred.reject(new Error('foo'));
    assert.deepEqual((await invertPromise(deferred.promise)).message, 'foo');
  });

  test('resolves only once', async () => {
    const deferred = new Deferred<string>();
    deferred.resolve('foo');
    try {
      deferred.resolve('bar');
      assert.fail();
    } catch (e) {
      // pass
    }
    try {
      deferred.reject(new Error('bar'));
      assert.fail();
    } catch (e) {
      // pass
    }
  });

  test('rejects', async () => {
    const deferred = new Deferred<string>();
    deferred.reject(new Error('foo'));
    deferred.promise.catch((_) => {});
    try {
      deferred.resolve('bar');
      assert.fail();
    } catch (e) {
      // pass
    }
    try {
      deferred.reject(new Error('bar'));
      assert.fail();
    } catch (e) {
      // pass
    }
  });
});
