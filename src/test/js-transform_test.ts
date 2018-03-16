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
import stripIndent = require('strip-indent');

import {jsTransform} from '../js-transform';

suite('jsTransform', () => {
  test('compiles to ES5', () => {
    assert.equal(
        jsTransform('const foo = 3;', {compileToEs5: true}), 'var foo = 3;');
  });

  test('minifies', () => {
    assert.equal(jsTransform('const foo = 3;', {minify: true}), 'const foo=3;');
  });

  test('compiles and minifies', () => {
    assert.equal(
        jsTransform('const foo = 3;', {compileToEs5: true, minify: true}),
        'var foo=3;');
  });

  test('does not unnecessarily reformat', () => {
    // Even with no transform plugins, parsing and serializing with Babel will
    // make some minor formatting changes to the code, such as removing trailing
    // newlines. Check that we don't do this when no transformations were
    // configured.
    assert.equal(jsTransform('const foo = 3;\n', {}), 'const foo = 3;\n');
  });

  test('rewrites bare module specifiers to paths', () => {
    const fixtureRoot =
        path.join(__dirname, '..', '..', 'test-fixtures', 'npm-modules');
    const filePath = path.join(fixtureRoot, 'foo.js');

    const input = stripIndent(`
      import { dep1 } from 'dep1';
      import { dep2 } from 'dep2';
      import { dep2A } from 'dep2/a';
      import { dep3 } from 'dep3';
      import { dep4 } from 'dep4';

      import { p1 } from '/already/a/path.js';
      import { p2 } from './already/a/path.js';
      import { p3 } from '../already/a/path.js';
      import { p4 } from '../already/a/path.js';
      import { p5 } from 'http://example.com/already/a/path.js';
    `);

    const expected = stripIndent(`
      import { dep1 } from './node_modules/dep1/index.js';
      import { dep2 } from './node_modules/dep2/dep2.js';
      import { dep2A } from './node_modules/dep2/a.js';
      import { dep3 } from './node_modules/dep3/dep3-module.js';
      import { dep4 } from './node_modules/dep4/dep4-module.js';

      import { p1 } from '/already/a/path.js';
      import { p2 } from './already/a/path.js';
      import { p3 } from '../already/a/path.js';
      import { p4 } from '../already/a/path.js';
      import { p5 } from 'http://example.com/already/a/path.js';
    `);

    const result = jsTransform(input, {moduleResolution: 'node', filePath});
    assert.equal(result.trim(), expected.trim());
  });

  test('transforms ES modules to AMD', () => {
    const input = stripIndent(`
      import { dep1 } from 'dep1';
      export const foo = 'foo';
    `);

    const expected = stripIndent(`
      define(['exports', 'dep1'], function (exports, _dep) {
          'use strict';

          Object.defineProperty(exports, "__esModule", {
              value: true
          });
          exports.foo = undefined;
          const foo = exports.foo = 'foo';
      });
    `);

    const result = jsTransform(input, {transformEsModulesToAmd: true});
    assert.equal(result.trim(), expected.trim());
  });
});
