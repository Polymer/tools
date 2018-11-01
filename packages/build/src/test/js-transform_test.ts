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
import {interceptOutput} from './util';

suite('jsTransform', () => {
  const rootDir =
      path.join(__dirname, '..', '..', 'test-fixtures', 'npm-modules');
  const filePath = path.join(rootDir, 'foo.js');

  suite('compilation', () => {
    test('compiles to ES5 when compile=true', () => {
      assert.equal(
          jsTransform('const foo = 3;', {compile: true}), 'var foo = 3;');
    });

    test('compiles to ES5 when compile=es5', () => {
      assert.equal(
          jsTransform('const foo = 3;', {compile: 'es5'}), 'var foo = 3;');
    });

    test('compiles to ES2015 when compile=es2015', () => {
      assert.equal(
          jsTransform('2 ** 5;', {compile: 'es2015'}), 'Math.pow(2, 5);');
    });

    test('compiles ES2017 to ES5', async () => {
      const result =
          jsTransform('async function test() { await 0; }', {compile: 'es5'});
      assert.include(result, '_asyncToGenerator');
      assert.notInclude(result, 'async function test');
      assert.include(result, 'regeneratorRuntime');
    });

    test('compiles ES2017 to ES2015', async () => {
      const result = jsTransform(
          'async function test() { await 0; }', {compile: 'es2015'});
      assert.include(result, 'asyncToGenerator');
      assert.notInclude(result, 'async function test');
      assert.notInclude(result, 'regeneratorRuntime');
    });

    test('does not unnecessarily reformat', () => {
      // Even with no transform plugins, parsing and serializing with Babel will
      // make some minor formatting changes to the code, such as removing
      // trailing newlines. Check that we don't do this when no transformations
      // were configured.
      assert.equal(jsTransform('const foo = 3;\n', {}), 'const foo = 3;\n');
    });
  });

  suite('minification', () => {
    test('minifies a simple expression', () => {
      assert.equal(
          jsTransform('const foo = 3;', {minify: true}), 'const foo=3;');
    });

    test('minifies an exported const', () => {
      assert.equal(
          jsTransform('const foo = "foo"; export { foo };', {minify: true}),
          'const foo="foo";export{foo};');
    });

    test('minifies and compiles', () => {
      assert.equal(
          jsTransform('const foo = 3;', {compile: true, minify: true}),
          'var foo=3;');
    });

    test('minifies but does not try to remove dead code', () => {
      assert.equal(
          jsTransform('if (false) { never(); } always();', {minify: true}),
          'if(!1){never()}always();');
    });
  });

  suite('babel helpers', () => {
    const classJs = `class MyClass {}`;
    const helperSnippet = `function _classCallCheck(`;

    test('inlined when external helpers are disabled', () => {
      const result =
          jsTransform(classJs, {compile: true, externalHelpers: false});
      assert.include(result, helperSnippet);
      assert.include(result, 'MyClass');
    });

    test('omitted when external helpers are enabled', () => {
      const result =
          jsTransform(classJs, {compile: true, externalHelpers: true});
      assert.notInclude(result, helperSnippet);
      assert.include(result, 'MyClass');
    });
  });

  suite('regenerator runtime', () => {
    const asyncJs = `async () => { await myFunction(); } `;
    const regeneratorSnippet = `regeneratorRuntime=`;

    test('inlined when external helpers are disabled', () => {
      const result =
          jsTransform(asyncJs, {compile: 'es5', externalHelpers: false});
      assert.include(result, regeneratorSnippet);
      assert.include(result, 'myFunction');
    });

    test('omitted when external helpers are enabled', () => {
      const result =
          jsTransform(asyncJs, {compile: 'es5', externalHelpers: true});
      assert.notInclude(result, regeneratorSnippet);
      assert.include(result, 'myFunction');
    });

    test('omitted when compile target is es2015', () => {
      const result =
          jsTransform(asyncJs, {compile: 'es2015', externalHelpers: false});
      assert.notInclude(result, regeneratorSnippet);
      assert.include(result, 'myFunction');
    });

    test('omitted when code does not require it', () => {
      const result = jsTransform(
          `class MyClass {}`, {compile: 'es5', externalHelpers: false});
      assert.notInclude(result, regeneratorSnippet);
      assert.include(result, 'MyClass');
    });
  });

  suite('parse errors', () => {
    const invalidJs = ';var{';

    test('throw when softSyntaxError is false', () => {
      assert.throws(
          () =>
              jsTransform(invalidJs, {compile: true, softSyntaxError: false}));
    });

    test('do not throw when softSyntaxError is true', async () => {
      const output = await interceptOutput(async () => {
        assert.equal(
            jsTransform(invalidJs, {compile: true, softSyntaxError: true}),
            invalidJs);
      });
      assert.include(output, '[polymer-build]: failed to parse JavaScript:');
    });
  });

  suite('exponentiation', () => {
    const js = 'const foo = 2**2;';

    test('minifies', () => {
      assert.equal(jsTransform(js, {minify: true}), 'const foo=2**2;');
    });

    test('compiles to ES5', () => {
      assert.equal(
          jsTransform(js, {compile: true}), 'var foo = Math.pow(2, 2);');
    });
  });

  suite('rest properties', () => {
    const js = 'let { x, y, ...z } = { x: 1, y: 2, a: 3, b: 4 };';

    test('minifies', () => {
      assert.equal(
          jsTransform(js, {minify: true}), 'let{x,y,...z}={x:1,y:2,a:3,b:4};');
    });

    test('compiles to ES5', () => {
      assert.include(
          jsTransform(js, {compile: true}),
          // Some compiled features are very verbose. Just look for the Babel
          // helper call so we know the plugin ran.
          'objectWithoutProperties');
    });
  });

  suite('spread properties', () => {
    const js = 'let n = { x, y, ...z };';

    test('minifies', () => {
      assert.equal(jsTransform(js, {minify: true}), 'let n={x,y,...z};');
    });

    test('compiles to ES5', () => {
      assert.include(jsTransform(js, {compile: true}), 'objectSpread');
    });
  });

  suite('async/await', () => {
    const js = 'async function foo() { await bar(); }';

    test('minifies', () => {
      assert.equal(
          jsTransform(js, {minify: true}), 'async function foo(){await bar()}');
    });

    test('compiles to ES5', () => {
      assert.include(jsTransform(js, {compile: true}), 'asyncToGenerator');
    });
  });

  suite('async generator', () => {
    const js = 'async function* foo() { yield bar; }';

    test('minifies', () => {
      assert.equal(
          jsTransform(js, {minify: true}), 'async function*foo(){yield bar}');
    });

    test('compiles to ES5', () => {
      assert.include(jsTransform(js, {compile: true}), 'wrapAsyncGenerator');
    });
  });

  suite('dynamic import', () => {
    const js = 'const foo = import("bar.js");';

    test('minifies', () => {
      assert.equal(
          jsTransform(js, {minify: true}), 'const foo=import("bar.js");');
    });
  });

  suite('rewrites bare module specifiers', () => {
    test('node packages', () => {
      const input = stripIndent(`
        import { dep1 } from 'dep1';
        import { dep2 } from 'dep2';
        import { dep2A } from 'dep2/a';
        import { dep3 } from 'dep3';
        import { dep4 } from 'dep4';
      `);

      const expected = stripIndent(`
        import { dep1 } from "./node_modules/dep1/index.js";
        import { dep2 } from "./node_modules/dep2/dep2.js";
        import { dep2A } from "./node_modules/dep2/a.js";
        import { dep3 } from "./node_modules/dep3/dep3-module.js";
        import { dep4 } from "./node_modules/dep4/dep4-module.js";
      `);

      const result = jsTransform(input, {moduleResolution: 'node', filePath});
      assert.equal(result.trim(), expected.trim());
    });

    test('regular paths and urls', () => {
      const input = stripIndent(`
        import { p1 } from '/already/a/path.js';
        import { p2 } from './already/a/path.js';
        import { p3 } from '../already/a/path.js';
        import { p4 } from '../already/a/path.js';
        import { p5 } from 'http://example.com/already/a/path.js';
      `);

      const expected = stripIndent(`
        import { p1 } from '/already/a/path.js';
        import { p2 } from './already/a/path.js';
        import { p3 } from '../already/a/path.js';
        import { p4 } from '../already/a/path.js';
        import { p5 } from 'http://example.com/already/a/path.js';
      `);

      const result = jsTransform(input, {moduleResolution: 'node', filePath});
      assert.equal(result.trim(), expected.trim());
    });

    test('paths that still need node resolution', () => {
      const input =
          // Resolves to a .js file.
          `import { bar } from './bar';\n` +
          // Resolves to a .json file (invalid for the web, but we still do it).
          `import { baz } from './baz';\n` +
          // Resolves to an actual extension-less file in preference to a .js
          // file with the same basename.
          `import { qux } from './qux';\n`;

      const expected = stripIndent(`
        import { bar } from "./bar.js";
        import { baz } from "./baz.json";
        import { qux } from './qux';
      `);

      const result = jsTransform(input, {moduleResolution: 'node', filePath});
      assert.equal(result.trim(), expected.trim());
    });

    test('paths for dependencies', () => {
      const input = stripIndent(`
        import { dep1 } from 'dep1';
      `);

      const expected = stripIndent(`
        import { dep1 } from "../dep1/index.js";
      `);

      const result = jsTransform(input, {
        moduleResolution: 'node',
        filePath,
        isComponentRequest: true,
        packageName: 'some-package',
        componentDir: path.join(rootDir, 'node_modules'),
        rootDir,
      });
      assert.equal(result.trim(), expected.trim());
    });

    test('dependencies from a scoped package', () => {
      const input = stripIndent(`
        import { dep1 } from 'dep1';
      `);

      const expected = stripIndent(`
        import { dep1 } from "../../dep1/index.js";
      `);

      const result = jsTransform(input, {
        moduleResolution: 'node',
        filePath,
        isComponentRequest: true,
        packageName: '@some-scope/some-package',
        componentDir: path.join(rootDir, 'node_modules'),
        rootDir,
      });
      assert.equal(result.trim(), expected.trim());
    });
  });

  test('transforms ES modules to AMD', () => {
    const input = stripIndent(`
      import { dep1 } from 'dep1';
      export const foo = 'foo';
    `);

    const expected = stripIndent(`
      define(["exports", "dep1"], function (_exports, _dep) {
        "use strict";

        Object.defineProperty(_exports, "__esModule", {
          value: true
        });
        _exports.foo = void 0;
        const foo = 'foo';
        _exports.foo = foo;
      });
    `);

    const result = jsTransform(input, {
      transformModulesToAmd: true,
      filePath,
      rootDir,
    });
    assert.equal(result.trim(), expected.trim());
  });

  test('transforms import.meta', () => {
    const input = stripIndent(`
      console.log(import.meta);
    `);

    const expected = stripIndent(`
      define(["meta"], function (meta) {
        "use strict";

        meta = babelHelpers.interopRequireWildcard(meta);
        console.log(meta);
      });
    `);

    const result = jsTransform(input, {
      transformModulesToAmd: true,
      externalHelpers: true,
    });
    assert.equal(result.trim(), expected.trim());
  });

  test('transforms dynamic import()', () => {
    const input = stripIndent(`
      import { dep1 } from 'dep1';
      export const foo = 'foo';
      console.log(import('./bar.js'));
    `);
    const result = jsTransform(input, {
      transformModulesToAmd: true,
      filePath,
      rootDir,
    });

    assert.include(
        result,
        `define(["exports", "require", "dep1"], function (_exports, _require, _dep) {`);
    assert.include(
        result,
        `console.log(new Promise((res, rej) => _require.default(['./bar.js'], res, rej)));`);
  });

  // https://github.com/babel/babel/pull/8501
  test('includes the native function check', () => {
    const input = stripIndent(`
      class TestElement extends HTMLElement {
        constructor() {
          super();
          this.x = 1234;
        }
      }

      window.customElements.define("test-element", TestElement);
    `);
    const result = jsTransform(input, {compile: true});

    assert.include(result, '_isNativeFunction');
  });

  // https://github.com/babel/minify/issues/824
  test('does not remove statements preceding certain loops', () => {
    const input = stripIndent(`
        let foo = 'bar';
        while (0);
        console.log(foo);
    `);
    const result = jsTransform(input, {compile: true, minify: true});

    assert.include(result, 'bar');
  });
});
