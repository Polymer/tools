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

import {rewriteImportMeta} from '../babel-plugin-import-meta';

suite('babel-plugin-import-meta', () => {
  test('transforms import.meta', () => {
    const input = stripIndent(`
      console.log(import.meta);
    `);

    const expected = stripIndent(`
      console.log({
        url: new URL("./bar.js", document.baseURI).toString()
      });
    `);
    const plugin = rewriteImportMeta('./bar.js');
    const result = babelCore.transform(input, {plugins: [plugin]}).code;
    assert.equal(result.trim(), expected.trim());
  });

  test('transforms import.meta with specified base', () => {
    const input = stripIndent(`
      console.log(import.meta);
    `);

    const expected = stripIndent(`
      console.log({
        url: new URL("./bar.js", 'http://foo.com/').toString()
      });
    `);
    const plugin = rewriteImportMeta('./bar.js', 'http://foo.com/');
    const result = babelCore.transform(input, {plugins: [plugin]}).code;
    assert.equal(result.trim(), expected.trim());
  });

  test('does not transform non-meta property', () => {
    const input = stripIndent(`
      console.log(foo.import.meta);
    `);

    const expected = stripIndent(`
      console.log(foo.import.meta);
    `);
    const plugin = rewriteImportMeta('./bar.js');
    const result = babelCore.transform(input, {plugins: [plugin]}).code;
    assert.equal(result.trim(), expected.trim());
  });
});
