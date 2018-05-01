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
import * as capabilities from '../browser-capabilities';

function assertBrowserCapabilities(
    userAgent: string, expect: capabilities.BrowserCapability[]) {
  assert.sameMembers([...capabilities.browserCapabilities(userAgent)], expect);
}

suite('capabilities', function() {
  test('unknown browser has no capabilities', () => {
    assertBrowserCapabilities('unknown browser', []);
  });

  test('chrome has all the capabilities', () => {
    assertBrowserCapabilities(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/66.0.3359.117 Safari/537.36',
        ['es2015', 'push', 'serviceworker', 'modules']);
  });

  test('chrome headless has all the capabilities', () => {
    assertBrowserCapabilities(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_3) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/66.0.3359.117 Safari/537.36',
        ['es2015', 'push', 'serviceworker', 'modules']);
  });

  test('edge es2015 support is predicated on minor browser version', () => {
    assertBrowserCapabilities(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.14986',
        ['push']);
    assertBrowserCapabilities(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/52.0.2743.116 Safari/537.36 Edge/15.15063',
        ['es2015', 'push']);
  });

  test('safari push capability is predicated on macOS version', () => {
    assertBrowserCapabilities(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.1 Safari/603.1.30',
        ['es2015']);
    assertBrowserCapabilities(
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11) AppleWebKit/603.1.30 (KHTML, like Gecko) Version/10.1 Safari/603.1.30',
        ['es2015', 'push']);
  });

  test('safari mobile modules capability is predicated on iOS version', () => {
    assertBrowserCapabilities(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 11_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15E148 Safari/604.1',
        ['es2015', 'push']);
    assertBrowserCapabilities(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 11_3 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15E148 Safari/604.1',
        ['es2015', 'push', 'modules']);
  });

  test('parseVersion parses with fallback to -1', () => {
    assert.deepEqual(capabilities.parseVersion('37'), [37]);
    assert.deepEqual(capabilities.parseVersion('10.987.00.1'), [10, 987, 0, 1]);
    assert.deepEqual(capabilities.parseVersion('4..foo.7'), [4, -1, -1, 7]);
  });

  test('versionAtLeast checks all required parts', () => {
    assert.isTrue(capabilities.versionAtLeast([3, 2, 1], [3, 2, 1]));
    assert.isTrue(capabilities.versionAtLeast([3, 2, 1], [3, 2, 1, 4]));
    assert.isTrue(capabilities.versionAtLeast([3, 2, 1], [4, 1, 0]));
    assert.isTrue(capabilities.versionAtLeast([3, 2, 0], [3, 2]));
    assert.isFalse(capabilities.versionAtLeast([3, 2, 1], [2, 2, 1]));
    assert.isFalse(capabilities.versionAtLeast([3, 2, 1], [3, 1, 1]));
    assert.isFalse(capabilities.versionAtLeast([3, 2, 1], [3, 1, 0]));
    assert.isFalse(capabilities.versionAtLeast([3, 2, 1], [3, 2]));
    assert.isFalse(capabilities.versionAtLeast([3, 2, 1], [3, 2]));
    assert.isFalse(capabilities.versionAtLeast([3, 2, 1], []));
  });
});
