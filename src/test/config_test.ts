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
import * as path from 'path';

import {getPackageName, getComponentDir} from '../config';

suite('getPackageName', () => {

  test('reads from bower.json', () => {
    const name =
        getPackageName({root: path.join(__dirname, '..', '..', 'test')});
    assert.equal(name, 'polyserve-test');
  });

});

suite('getComponentDir', () => {

  test('defaults to bower_components', () => {
    const dir =
        getComponentDir({root: path.join(__dirname, '..', '..', 'test')});
    assert.equal(dir, 'bower_components');
  });

  test('reads from .bowerrc', () => {
    const dir =
        getComponentDir({root: path.join(__dirname, '..', '..', 'test', 'bowerrc')});
    assert.equal(dir, 'my_components');
  });

});
