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
import {join as pathJoin, sep as pathSeparator} from 'path';
import {PackageRelativeUrl} from 'polymer-analyzer';
import {LocalFsPath, pathFromUrl, urlFromPath} from '../path-transformers';

const WindowsRootPath = 'C:\\Users\\TEST_USER\\TEST_ROOT' as LocalFsPath;
const MacRootPath = '/Users/TEST_USER/TEST_ROOT' as LocalFsPath;
const RootPath = pathSeparator === '\\' ? WindowsRootPath : MacRootPath;

suite('pathFromUrl()', () => {
  test('creates a filesystem path using the platform separators', () => {
    const otherSeparator = pathSeparator === '/' ? '\\' : '/';
    const path =
        pathFromUrl(RootPath, '/some/url/pathname' as PackageRelativeUrl);
    assert.include(path, pathSeparator);
    assert.notInclude(path, otherSeparator);
  });

  test('returns a path if url is absolute', () => {
    const path = pathFromUrl(RootPath, '/absolute/path' as PackageRelativeUrl);
    assert.equal(path, pathJoin(RootPath, 'absolute', 'path'));
  });

  test('returns a path if url relative', () => {
    const path = pathFromUrl(RootPath, 'relative/path' as PackageRelativeUrl);
    assert.equal(path, pathJoin(RootPath, 'relative', 'path'));
  });

  test('will not go outside the root path', () => {
    const path = pathFromUrl(
        RootPath, '../../../still/../root/path' as PackageRelativeUrl);
    assert.equal(path, pathJoin(RootPath, 'root', 'path'));
  });

  test('will decode URI percent encoded characters', () => {
    const path =
        pathFromUrl(RootPath, '/%40foo/spaced%20out' as PackageRelativeUrl);
    assert.equal(path, pathJoin(RootPath, '/@foo/spaced out'));
  });
});

suite('urlFromPath()', () => {
  test('throws error when path is not in root', () => {
    assert.throws(() => {
      urlFromPath(
          '/this/is/a/path' as LocalFsPath,
          '/some/other/path/shop-app.html' as LocalFsPath);
    });
    assert.throws(() => {
      urlFromPath(
          '/the/path' as LocalFsPath,
          '/the/pathologist/index.html' as LocalFsPath);
    });
  });

  test('creates a URL path relative to root', () => {
    const shortPath = urlFromPath(
        RootPath, pathJoin(RootPath, 'shop-app.html') as LocalFsPath);
    assert.equal(shortPath, 'shop-app.html');
    const medPath = urlFromPath(
        RootPath, pathJoin(RootPath, 'src', 'shop-app.html') as LocalFsPath);
    assert.equal(medPath, 'src/shop-app.html');
    const longPath = urlFromPath(
        RootPath,
        pathJoin(RootPath, 'bower_components', 'app-layout', 'docs.html') as
            LocalFsPath);
    assert.equal(longPath, 'bower_components/app-layout/docs.html');
  });

  test('will properly encode URL-unfriendly characters like spaces', () => {
    const url =
        urlFromPath(RootPath, pathJoin(RootPath, 'spaced out') as LocalFsPath);
    assert.equal(url, 'spaced%20out');
  });
});
