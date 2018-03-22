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

import {htmlTransform} from '../html-transform';

const collapseWhitespace = (s: string) =>
    s.replace(/^\s+/gm, '').replace(/\s+$/gm, '').replace(/\n/gm, '');

const assertEqualIgnoringWhitespace = (actual: string, expected: string) =>
    assert.equal(collapseWhitespace(actual), collapseWhitespace(expected));

suite('htmlTransform', () => {
  test('compiles inline JavaScript to ES5', () => {
    const input = `
      <html><head></head><body>
        <script>const foo = 3;</script>
      </body></html>`;

    const expected = `
      <html><head></head><body>
        <script>var foo = 3;</script>
      </body></html>`;

    assertEqualIgnoringWhitespace(
        htmlTransform(input, {js: {compileToEs5: true}}), expected);
  });

  test('minifies inline JavaScript', () => {
    const input = `
      <html><head></head><body>
        <script>const foo = 3;</script>
      </body></html>`;

    const expected = `
      <html><head></head><body>
        <script>const foo=3;</script>
      </body></html>`;

    assertEqualIgnoringWhitespace(
        htmlTransform(input, {js: {minify: true}}), expected);
  });

  test('rewrites bare module specifiers to paths', () => {
    const fixtureRoot =
        path.join(__dirname, '..', '..', 'test-fixtures', 'npm-modules');
    const filePath = path.join(fixtureRoot, 'foo.html');

    const input = `
      <html><head></head><body>
        <script type="module">
          import { dep1 } from 'dep1';
        </script>
      </body></html>`;

    const expected = `
      <html><head></head><body>
        <script type="module">
          import { dep1 } from './node_modules/dep1/index.js';
        </script>
      </body></html>`;

    assertEqualIgnoringWhitespace(
        htmlTransform(input, {js: {moduleResolution: 'node', filePath}}),
        expected);
  });

  suite('transform ES modules to AMD', () => {
    test('external script', () => {
      const input = `
        <html><head></head><body>
          <script type="module" src="depA.js"><script>
        </body></html>`;

      const expected = `
        <html><head></head><body>
          <script>
            define('polymer-build-generated-module-0', ['depA.js']);
            require(['polymer-build-generated-module-0']);
          </script>
        </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {
            js: {
              transformEsModulesToAmd: true,
            }
          }),
          expected);
    });

    test('inline script', () => {
      const input = `
        <html><head></head><body>
          <script type="module">
            import { depA } from './depA.js';
            console.log(depA);
          </script>
        </body></html>`;

      const expected = `
        <html><head></head><body>
          <script>
            define('polymer-build-generated-module-0', ['./depA.js'], function (_depA) {
              'use strict';
              console.log(_depA.depA);
            });
            require(['polymer-build-generated-module-0']);
          </script>
        </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {js: {transformEsModulesToAmd: true}}),
          expected);
    });

    test('chains inline and external module scripts', () => {
      const input = `
        <html><head></head><body>
          <script type="module">import { depA } from './depA.js';</script>
          <script type="module" src="./depB.js"></script>
          <script type="module">import { depC } from './depC.js';</script>
          <script type="module" src="./depD.js"></script>
        </body></html>`;

      const expected = `
      <html><head></head><body>
        <script>define('polymer-build-generated-module-0', ['./depA.js'], function (_depA) {'use strict';});</script>
        <script>define('polymer-build-generated-module-1', ['polymer-build-generated-module-0', './depB.js']);</script>
        <script>define('polymer-build-generated-module-2', ['polymer-build-generated-module-1', './depC.js'], function (_depC) {'use strict';});</script>
        <script>define('polymer-build-generated-module-3', ['polymer-build-generated-module-2', './depD.js']);
                require(['polymer-build-generated-module-3']);</script>
      </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {js: {transformEsModulesToAmd: true}}),
          expected);
    });

    test('compiles non-module script without AMD plugin', () => {
      const input = `
        <html><head></head><body>
          <script>const foo = 3;</script>
        </body></html>`;

      const expected = `
        <html><head></head><body>
          <script>var foo = 3;</script>
        </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {
            js: {
              compileToEs5: true,
              transformEsModulesToAmd: true,
            }
          }),
          expected);
    });

    test('does not transform when "nomodule" script present', () => {
      const input = `
        <html><head></head><body>
          <script type="module">
            import { depA } from './depA.js';
            console.log(depA);
          </script>

          <script nomodule="">
            // Handle browsers without ES modules some other way.
          </script>
        </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {js: {transformEsModulesToAmd: true}}), input);
    });

    test('adds require.js script to entry point before first module', () => {
      const input = `
        <html><head></head><body>
          <script>console.log('non-module');</script>

          <script type="module" src="depA.js"><script>
        </body></html>`;

      const expected = `
        <html><head></head><body>
          <script>console.log('non-module');</script>

          <script src="/node_modules/require.js"></script>

          <script>
            define('polymer-build-generated-module-0', ['depA.js']);
            require(['polymer-build-generated-module-0']);
          </script>
        </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {
            isEntryPoint: true,
            requireJsUrl: '/node_modules/require.js',
            js: {
              transformEsModulesToAmd: true,
            }
          }),
          expected);
    });

    test('adds hack for Web Component Tester', () => {
      const input = `
        <html><head></head><body>
          <script src="web-component-tester/browser.js"></script>

          <script type="module" src="depA.js"></script>
        </body></html>`;

      const expected = `
        <html><head></head><body>
          <script>
            // Injected by polymer-build to defer WCT until all AMD modules are loaded.
            (function() {
              window.WCT = window.WCT || {};
              var originalWaitFor = window.WCT.waitFor;
              window.WCT.waitFor = function(cb) {
                window._wctCallback = function() {
                  if (originalWaitFor) {
                    originalWaitFor(cb);
                  } else {
                    cb();
                  }
                };
              };
            }());
          </script>

          <script src="web-component-tester/browser.js"></script>

          <script src="/node_modules/require.js"></script>

          <script>
            // Injected by polymer-build to defer WCT until all AMD modules are loaded.
            (function() {
              var originalRequire = window.require;
              var moduleCount = 0;
              window.require = function(deps, factory) {
                moduleCount++;
                originalRequire(deps, function() {
                  if (factory) {
                    factory.apply(undefined, arguments);
                  }
                  moduleCount--;
                  if (moduleCount === 0) {
                    window._wctCallback();
                  }
                });
              };
            })();
          </script>

          <script>
            define('polymer-build-generated-module-0', ['depA.js']);
            require(['polymer-build-generated-module-0']);
          </script>
        </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {
            isEntryPoint: true,
            requireJsUrl: '/node_modules/require.js',
            js: {
              transformEsModulesToAmd: true,
            }
          }),
          expected);
    });
  });
});
