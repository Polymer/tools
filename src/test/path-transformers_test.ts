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
import {join as pathJoin, sep as pathSeparator} from 'path';

import {pathFromUrl, urlFromPath} from '../path-transformers';

const WindowsRootPath = 'C:\\Users\\TEST_USER\\TEST_ROOT';
const MacRootPath = '/Users/TEST_USER/TEST_ROOT';
const RootPath = pathSeparator === '\\' ? WindowsRootPath : MacRootPath;

suite('pathFromUrl()', () => {

  test('creates a filesystem path using the platform separators', () => {
    const otherSeparator = pathSeparator === '/' ? '\\' : '/';
    const path = pathFromUrl(RootPath, '/some/url/pathname');
    assert.include(path, pathSeparator);
    assert.notInclude(path, otherSeparator);
  });

  test('returns a path if url is absolute', () => {
    const path = pathFromUrl(RootPath, '/absolute/path');
    assert.equal(path, pathJoin(RootPath, 'absolute', 'path'));
  });

  test('returns a path if url relative', () => {
    const path = pathFromUrl(RootPath, 'relative/path');
    assert.equal(path, pathJoin(RootPath, 'relative', 'path'));
  });

  test('will not go outside the root path', () => {
    const path = pathFromUrl(RootPath, '../../../still/../root/path');
    assert.equal(path, pathJoin(RootPath, 'root', 'path'));
  });

  test('will unencode the URI-encoded sequences, like spaces', () => {
    const path = pathFromUrl(RootPath, '/spaced%20out');
    assert.equal(path, pathJoin(RootPath, 'spaced out'));
  });
});

suite('urlFromPath()', () => {

  test('throws error when path is not in root', () => {
    assert.throws(() => {
      urlFromPath('/this/is/a/path', '/some/other/path/shop-app.html');
    });
    assert.throws(() => {
      urlFromPath('/the/path', '/the/pathologist/index.html');
    });
  });

  test('creates a URL path relative to root', () => {
    const shortPath =
        urlFromPath(RootPath, pathJoin(RootPath, 'shop-app.html'));
    assert.equal(shortPath, 'shop-app.html');
    const medPath =
        urlFromPath(RootPath, pathJoin(RootPath, 'src', 'shop-app.html'));
    assert.equal(medPath, 'src/shop-app.html');
    const longPath = urlFromPath(
        RootPath,
        pathJoin(RootPath, 'bower_components', 'app-layout', 'docs.html'));
    assert.equal(longPath, 'bower_components/app-layout/docs.html');
  });

  test('will properly encode URL-unfriendly characters like spaces', () => {
    const url = urlFromPath(RootPath, pathJoin(RootPath, 'spaced out'));
    assert.equal(url, 'spaced%20out');
  });
});
