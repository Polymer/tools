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

import * as babelCore from '@babel/core';
import stripIndent = require('strip-indent');
import {assert} from 'chai';
import * as path from 'path';

import {resolveBareSpecifiers} from '../babel-plugin-bare-specifiers';

suite('babel-plugin-bare-specifiers', () => {
  const rootDir =
      path.join(__dirname, '..', '..', 'test-fixtures', 'npm-modules');
  const filePath = path.join(rootDir, 'foo.js');
  const resolveBareSpecifiersTransform = resolveBareSpecifiers(filePath, false);

  test('transforms import()', () => {
    const input = stripIndent(`
      const dep1 = import('dep1');
    `);

    const expected = stripIndent(`
      const dep1 = import("./node_modules/dep1/index.js");
    `);
    const result =
        babelCore.transform(input, {plugins: [resolveBareSpecifiersTransform]})
            .code;
    assert.equal(result.trim(), expected.trim());
  });
});
