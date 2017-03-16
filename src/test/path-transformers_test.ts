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

/// <reference path="../../node_modules/@types/mocha/index.d.ts" />

import {assert} from 'chai';
import {sep as pathSeparator} from 'path';

import {isPlatformWindows, pathFromUrl, urlFromPath} from '../path-transformers';

const WindowsRootPath = 'C:\\Users\\TEST_USER\\TEST_ROOT';
const MacRootPath = '/Users/TEST_USER/TEST_ROOT';
const RootPath = isPlatformWindows() ? WindowsRootPath : MacRootPath;

suite('pathFromUrl()', () => {

  test('creates a filesystem path using the platform separators', () => {
    const otherSeparator = pathSeparator === '/' ? '\\' : '/';
    const path = pathFromUrl(RootPath, '/some/url/pathname');
    assert.include(path, pathSeparator);
    assert.notInclude(path, otherSeparator);
  });

  test('returns a path if url is absolute', () => {
    const path = pathFromUrl(RootPath, '/absolute/path');
    assert.equal(path, [RootPath, 'absolute', 'path'].join(pathSeparator));
  });

  test('returns a path if url relative', () => {
    const path = pathFromUrl(RootPath, 'relative/path');
    assert.equal(path, [RootPath, 'relative', 'path'].join(pathSeparator));
  });

  test('will not go outside the root path', () => {
    const path = pathFromUrl(RootPath, '../../../still/../root/path');
    assert.equal(path, [RootPath, 'root', 'path'].join(pathSeparator));
  });
});

suite('urlFromPath()', () => {

  test('throws error when path is not in root', () => {
    assert.throws(function() {
      urlFromPath(MacRootPath, '/some/other/path/shop-app.html');
    });
  });

  if (isPlatformWindows()) {
    test(
        'creates a URL path relative to root when called in a Windows environment',
        () => {
          const shortPath =
              urlFromPath(WindowsRootPath, WindowsRootPath + '\\shop-app.html');
          assert.equal(shortPath, 'shop-app.html');
          const medPath = urlFromPath(
              WindowsRootPath, WindowsRootPath + '\\src\\shop-app.html');
          assert.equal(medPath, 'src/shop-app.html');
          const longPath = urlFromPath(
              WindowsRootPath,
              WindowsRootPath + '\\bower_components\\app-layout\\docs.html');
          assert.equal(longPath, 'bower_components/app-layout/docs.html');
        });

  } else {
    test(
        'creates a URL path relative to root when called in a Posix environment',
        () => {
          const shortPath =
              urlFromPath(MacRootPath, MacRootPath + '/shop-app.html');
          assert.equal(shortPath, 'shop-app.html');
          const medPath =
              urlFromPath(MacRootPath, MacRootPath + '/src/shop-app.html');
          assert.equal(medPath, 'src/shop-app.html');
          const longPath = urlFromPath(
              MacRootPath,
              MacRootPath + '/bower_components/app-layout/docs.html');
          assert.equal(longPath, 'bower_components/app-layout/docs.html');
        });
  }

});
