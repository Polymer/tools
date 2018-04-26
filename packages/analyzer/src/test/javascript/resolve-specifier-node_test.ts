/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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
import * as path from 'path';

import {resolve} from '../../javascript/resolve-specifier-node';

const rootDir = path.resolve(
    __dirname,
    '..',
    '..',
    '..',
    'src',
    'test',
    'static',
    'javascript',
    'resolve-specifier-node');

const rootMain = path.join(rootDir, 'root.js');
const componentDir = path.join(rootDir, 'node_modules');
const shallowDepMain = path.join(componentDir, 'shallow', 'shallow.js');
const scopedDepMain = path.join(componentDir, '@scope', 'scoped', 'scoped.js');

const shallowRootComponentInfo = {
  packageName: 'root',
  rootDir,
  componentDir
};

const scopedRootComponentInfo = {
  packageName: '@scope/root',
  rootDir,
  componentDir
};

suite('resolve', () => {
  test('non-component root to path', async () => {
    assert.equal(resolve('./root.js', rootMain), './root.js');
  });

  test('non-component root to shallow dep', async () => {
    assert.equal(
        resolve('shallow', rootMain), './node_modules/shallow/shallow.js');
  });

  test('non-component root to scoped dep', async () => {
    assert.equal(
        resolve('@scope/scoped', rootMain),
        './node_modules/@scope/scoped/scoped.js');
  });

  test('shallow dep to scoped dep', async () => {
    assert.equal(
        resolve('@scope/scoped', shallowDepMain, shallowRootComponentInfo),
        '../@scope/scoped/scoped.js');
  });

  test('scoped dep to shallow dep', async () => {
    assert.equal(
        resolve('shallow', scopedDepMain, shallowRootComponentInfo),
        '../../shallow/shallow.js');
  });

  test('component-root to path', async () => {
    assert.equal(
        resolve('./root.js', rootMain, shallowRootComponentInfo), './root.js');
  });

  test('component-root to shallow dep', async () => {
    assert.equal(
        resolve('shallow', rootMain, shallowRootComponentInfo),
        '../shallow/shallow.js');
  });

  test('component-root to scoped dep', async () => {
    assert.equal(
        resolve('@scope/scoped', rootMain, shallowRootComponentInfo),
        '../@scope/scoped/scoped.js');
  });

  test('scoped-component-root to shallow dep', async () => {
    assert.equal(
        resolve('shallow', rootMain, scopedRootComponentInfo),
        '../../shallow/shallow.js');
  });

  test('scoped-component-root to scoped dep', async () => {
    assert.equal(
        resolve('@scope/scoped', rootMain, scopedRootComponentInfo),
        '../scoped/scoped.js');
  });
});
