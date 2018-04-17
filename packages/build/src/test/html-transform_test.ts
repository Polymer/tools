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
import * as dom5 from 'dom5/lib/index-next';
import * as parse5 from 'parse5';
import * as path from 'path';

import {htmlTransform} from '../html-transform';

import {assertEqualIgnoringWhitespace} from './util';

/**
 * Replaces the Babel helpers, Require.js AMD loader, and WCT hack inline
 * scripts into just some comments, to make test comparison simpler.
 */
function replaceGiantScripts(html: string): string {
  const document = parse5.parse(html);
  for (const script of dom5.queryAll(
           document, dom5.predicates.hasTagName('script'))) {
    const js = dom5.getTextContent(script);
    if (js.includes('var requirejs,require')) {
      dom5.setTextContent(script, '// amd loader');
    } else if (js.includes('wrapNativeSuper=')) {
      dom5.setTextContent(script, '// babel helpers full');
    } else if (js.includes('interopRequireDefault=')) {
      dom5.setTextContent(script, '// babel helpers amd');
    } else if (js.includes('window._wctCallback =')) {
      dom5.setTextContent(script, '// wct hack 1/2');
    } else if (js.includes('window._wctCallback()')) {
      dom5.setTextContent(script, '// wct hack 2/2');
    }
  }
  return parse5.serialize(document);
}

suite('htmlTransform', () => {
  const fixtureRoot =
      path.join(__dirname, '..', '..', 'test-fixtures', 'npm-modules');

  test('minifies html', () => {
    const input = `
      <html>
        <body>
          <!-- pointless comment -->
          <p>Hello World!</p>
        </body>
      </html>`;

    const expected = `<html><body><p>Hello World!</p></body></html>`;

    assert.equal(htmlTransform(input, {minifyHtml: true}), expected);
  });

  test('does not add unnecessary tags', () => {
    const input = `<p>Just me</p>`;
    assert.equal(htmlTransform(input, {}), input);
  });

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

  test('injects full babel helpers', () => {
    const input = `
      <html><head></head><body>
        <script>const foo = 3;</script>
      </body></html>`;

    const expected = `
      <html><head></head><body>
        <script>// babel helpers full</script>
        <script>const foo = 3;</script>
      </body></html>`;

    const result = htmlTransform(input, {injectBabelHelpers: 'full'});
    assertEqualIgnoringWhitespace(replaceGiantScripts(result), expected);
  });

  test('injects AMD babel helpers', () => {
    const input = `
      <html><head></head><body>
        <script>const foo = 3;</script>
      </body></html>`;

    const expected = `
      <html><head></head><body>
        <script>// babel helpers amd</script>
        <script>const foo = 3;</script>
      </body></html>`;

    const result = htmlTransform(input, {injectBabelHelpers: 'amd'});
    assertEqualIgnoringWhitespace(replaceGiantScripts(result), expected);
  });

  test('rewrites bare module specifiers to paths', () => {
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
          import { dep1 } from "./node_modules/dep1/index.js";
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
          <script type="module" src="depA.js"></script>
        </body></html>`;

      const expected = `
        <html><head></head><body>
          <script>define('polymer-build-generated-module-0', ['depA.js']);</script>
          <script>require(['polymer-build-generated-module-0']);</script>
        </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {
            js: {
              transformModulesToAmd: true,
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
            define('polymer-build-generated-module-0', ["./depA.js"], function (_depA) {
              "use strict";
              console.log(_depA.depA);
            });
          </script>

          <script>require(['polymer-build-generated-module-0']);</script>
        </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {
            js: {
              transformModulesToAmd: true,
              filePath: path.join(fixtureRoot, 'foo.html'),
              rootDir: fixtureRoot,
            },
          }),
          expected);
    });

    test('chains inline and external module scripts', () => {
      const input = `
        <html><head></head><body>
          <script type="module">import { depA } from './depA.js';</script>
          <script type="module" src="./depB.js"></script>
          <script type="module">import { depC } from './depC.js';</script>
          <script type="module">'no imports';</script>
          <script type="module" src="./depD.js"></script>
        </body></html>`;

      const expected = `
      <html><head></head><body>
        <script>define('polymer-build-generated-module-0', ["./depA.js"], function (_depA) {"use strict";});</script>
        <script>define('polymer-build-generated-module-1', ['./depB.js', 'polymer-build-generated-module-0']);</script>
        <script>define('polymer-build-generated-module-2', ["./depC.js", 'polymer-build-generated-module-1'], function (_depC) {"use strict";});</script>
        <script>define('polymer-build-generated-module-3', ['polymer-build-generated-module-2'], function () {"use strict";'no imports';});</script>
        <script>define('polymer-build-generated-module-4', ['./depD.js', 'polymer-build-generated-module-3']);</script>
        <script>require(['polymer-build-generated-module-4']);</script>
      </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {
            js: {
              transformModulesToAmd: true,
              filePath: path.join(fixtureRoot, 'foo.html'),
              rootDir: fixtureRoot,
            }
          }),
          expected);
    });

    test('resolves names and does AMD transform', () => {
      const input = `
        <html><head></head><body>
          <script type="module">import { dep1 } from 'dep1';</script>
        </body></html>`;

      const expected = `
      <html><head></head><body>
        <script>define('polymer-build-generated-module-0', ["./node_modules/dep1/index.js"], function (_index) {"use strict";});</script>
        <script>require(['polymer-build-generated-module-0']);</script>
      </body></html>`;

      assertEqualIgnoringWhitespace(
          htmlTransform(input, {
            js: {
              transformModulesToAmd: true,
              moduleResolution: 'node',
              filePath: path.join(fixtureRoot, 'foo.html'),
              rootDir: fixtureRoot,
            }
          }),
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
              transformModulesToAmd: true,
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
          htmlTransform(input, {js: {transformModulesToAmd: true}}), input);
    });

    test('adds AMD loader to entry point before first module', () => {
      const input = `
        <html><head></head><body>
          <script>console.log('non-module');</script>

          <script type="module" src="depA.js"></script>
        </body></html>`;

      const expected = `
        <html><head></head><body>
          <script>console.log('non-module');</script>

          <script>// amd loader</script>

          <script>define('polymer-build-generated-module-0', ['depA.js']);</script>

          <script>require(['polymer-build-generated-module-0']);</script>
        </body></html>`;

      const result = htmlTransform(input, {
        injectAmdLoader: true,
        js: {
          transformModulesToAmd: true,
        },
      });
      assertEqualIgnoringWhitespace(replaceGiantScripts(result), expected);
    });

    test('does not add AMD loader when no modules', () => {
      const input = `
        <html><head></head><body>
          <script>console.log('non-module');</script>
          <script src="depA.js"></script>
        </body></html>`;

      const result = htmlTransform(input, {
        injectAmdLoader: true,
        js: {
          transformModulesToAmd: true,
        },
      });
      assertEqualIgnoringWhitespace(result, input);
    });

    test('adds hack for Web Component Tester', () => {
      const input = `
        <html><head></head><body>
          <script src="web-component-tester/browser.js"></script>

          <script type="module" src="depA.js"></script>
        </body></html>`;

      const expected = `
        <html><head></head><body>
          <script>// wct hack 1/2</script>

          <script src="web-component-tester/browser.js"></script>

          <script>// amd loader</script>

          <script>// wct hack 2/2</script>

          <script>define('polymer-build-generated-module-0', ['depA.js']);</script>

          <script>require(['polymer-build-generated-module-0']);</script>
        </body></html>`;

      const result = htmlTransform(input, {
        injectAmdLoader: true,
        js: {
          transformModulesToAmd: true,
        },
      });
      assertEqualIgnoringWhitespace(replaceGiantScripts(result), expected);
    });
  });
});
