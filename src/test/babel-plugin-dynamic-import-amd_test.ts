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

import {dynamicImportAmd} from '../babel-plugin-dynamic-import-amd';

const babelTransformModulesAmd = require('@babel/plugin-transform-modules-amd');

suite('babel-plugin-transform-modules-amd', () => {
  test('transforms import()', () => {
    const input = stripIndent(`
      const foo = import('./foo.js');
    `);

    const expected = stripIndent(`
      import * as _require from 'require';
      const foo = new Promise((res, rej) => _require.default(['./foo.js'], res, rej));
    `);
    const result =
        babelCore.transform(input, {plugins: [dynamicImportAmd]}).code;
    assert.equal(result.trim(), expected.trim());
  });

  test('chooses unique name for require()', () => {
    const input = stripIndent(`
      let _require = true;
      const foo = import('./foo.js');
      {
        let _require2 = true;
        import('./bar.js');
      }
    `);

    const expected = stripIndent(`
      import * as _require3 from 'require';
      let _require = true;
      const foo = new Promise((res, rej) => _require3.default(['./foo.js'], res, rej));
      {
        let _require2 = true;
        new Promise((res, rej) => _require3.default(['./bar.js'], res, rej));
      }
    `);
    const result =
        babelCore.transform(input, {plugins: [dynamicImportAmd]}).code;
    assert.equal(result.trim(), expected.trim());
  });

  test('integrates with AMD transform', () => {
    const input = stripIndent(`
      import {bar} from './bar.js';
      const foo = import('./foo.js');
    `);
    const result =
        babelCore
            .transform(
                input, {plugins: [dynamicImportAmd, babelTransformModulesAmd]})
            .code;
    assert.include(
        result, `define(["require", "./bar.js"], function (_require, _bar) {`);
    assert.include(
        result,
        `const foo = new Promise((res, rej) => _require.default(['./foo.js'], res, rej));`);
  });
});
