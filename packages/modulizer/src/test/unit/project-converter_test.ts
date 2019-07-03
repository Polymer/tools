/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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
import * as esprima from 'esprima';
import * as estree from 'estree';
import {EOL} from 'os';
import {Analyzer, InMemoryOverlayUrlLoader, PackageUrlResolver} from 'polymer-analyzer';

import {createDefaultConversionSettings, NpmImportStyle, PartialConversionSettings} from '../../conversion-settings';
import {getMemberPath} from '../../document-util';
import {saveDependencyMapping} from '../../package-manifest';
import {ProjectConverter} from '../../project-converter';
import {PackageUrlHandler} from '../../urls/package-url-handler';
import {OriginalDocumentUrl, PackageType} from '../../urls/types';

/*
A few conventions in these tests:
  - Most are written as two calls, setSources and assertSources.
    The first defines the code we're converting, the second asserts
    on the output of the conversion.
  - test.html is considered a `main` file. If it's given in setSources it
    will be converted to js even if it's not imported by anything else.
  - index.html is the convention for a file that is intended to be maintained
    as HTML.
 */

suite('AnalysisConverter', () => {
  suiteSetup(() => {
    saveDependencyMapping('some-package', 'some-package', '^1.2.34567890');
  });

  suite('_convertDocument', () => {
    let urlLoader: InMemoryOverlayUrlLoader;
    const urlResolver = new PackageUrlResolver();
    let analyzer: Analyzer;

    setup(() => {
      urlLoader = new InMemoryOverlayUrlLoader();
      analyzer = new Analyzer({urlLoader, urlResolver});
    });

    function interceptWarnings() {
      const warnings: string[] = [];
      const originalConsoleWarn = console.warn;
      const originalConsoleErr = console.error;

      console.warn = console.error = (...args: Array<{}>) => {
        warnings.push(args.join(''));
      };

      return function unintercept() {
        console.warn = originalConsoleWarn;
        console.error = originalConsoleErr;
        return warnings;
      };
    }

    interface TestConversionOptions extends PartialConversionSettings {
      bowerPackageName: string;
      npmPackageName: string;
      packageType: PackageType;
      npmImportStyle: NpmImportStyle;
      expectedWarnings: string[];
      packageEntrypoints: Map<string, OriginalDocumentUrl[]>;
    }

    async function convert(
        partialOptions: Partial<TestConversionOptions> = {}) {
      // Extract options & settings /w defaults.
      const {
        npmPackageName = 'some-package',
        bowerPackageName = 'some-package',
        packageType = 'element',
        expectedWarnings = [],
        packageEntrypoints =
            new Map([['some-package', ['test.html' as OriginalDocumentUrl]]]),
      } = partialOptions;

      const partialSettings: PartialConversionSettings = {
        namespaces: partialOptions.namespaces || ['Polymer'],
        excludes: partialOptions.excludes,
        referenceExcludes: partialOptions.referenceExcludes,
        npmImportStyle: partialOptions.npmImportStyle,
        addImportMeta: partialOptions.addImportMeta,
        flat: false,
        private: false,
        packageEntrypoints,
      };
      // Analyze all given files.
      const allTestUrls = [...urlLoader.urlContentsMap.keys()];
      const analysis = await analyzer.analyze(allTestUrls);
      // Setup ConversionSettings, set "test.html" as default entrypoint.
      const conversionSettings =
          createDefaultConversionSettings(analysis, partialSettings);
      // Setup ProjectScanner, use PackageUrlHandler for easy setup.
      const urlHandler = new PackageUrlHandler(
          analyzer, bowerPackageName, npmPackageName, packageType, __dirname);
      const converter =
          await new ProjectConverter(analysis, urlHandler, conversionSettings);
      // Gather all relevent package documents, and run the converter!
      const stopIntercepting = interceptWarnings();
      await converter.convertPackage(bowerPackageName);
      // Assert warnings matched expected.
      const warnings = stopIntercepting();
      assert.deepEqual(
          warnings,
          expectedWarnings,
          'console.warn() and console.error() calls differ from expected.');
      // Return results for assertion.
      return converter.getResults();
    }

    function assertSources(
        results: Map<string, string|undefined>,
        expected: {[path: string]: string|undefined}) {
      for (const [expectedPath, expectedContents] of Object.entries(expected)) {
        assert.isTrue(
            results.has(expectedPath),
            `No output named ${expectedPath} was generated. ` +
                `Generated outputs: ${[...results.keys()].join(', ')}`);
        const actualContents = results.get(expectedPath);
        if (actualContents === undefined) {
          assert.deepEqual(
              actualContents,
              expectedContents,
              `${expectedPath} was unexpectedly deleted! ` +
                  `Generated outputs: ${[...results.keys()].join(', ')}`);
        } else if (expectedContents === undefined) {
          assert.deepEqual(
              actualContents,
              expectedContents,
              `${expectedPath} should have been deleted. ` +
                  `Generated outputs: ${[...results.keys()].join(', ')}`);
        } else {
          assert.deepEqual(
              '\n' + actualContents.split(EOL).join('\n'),
              expectedContents,
              `Content of ${expectedPath} is wrong`);
        }
      }
    }

    function setSources(sources: {[filename: string]: string}) {
      for (const [filename, source] of Object.entries(sources)) {
        urlLoader.urlContentsMap.set(analyzer.resolveUrl(filename)!, source);
      }
    }

    test('converts imports to .js', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./dep.html">
          <link rel="import" href="../dep/dep.html">
          <script></script>
        `,
        'dep.html': `<h1>Hi</h1>`,
        'bower_components/dep/dep.html': `<h1>Hi</h1>`,
      });
      const expectedWarnings = [
        `WARN: bower->npm mapping for "dep" not found`,
      ];
      assertSources(
          await convert({
            expectedWarnings,
            packageEntrypoints: new Map([
              ['some-package', ['test.html' as OriginalDocumentUrl]],
              ['dep', ['dep.html' as OriginalDocumentUrl]]
            ]),
          }),
          {
            'test.js': `
import './dep.js';
import '../dep/dep.js';
`,
            'test.html': undefined
          });
    });

    test('converts dependency imports for an element', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./nested/test.html">
          <link rel="import" href="../app-storage/app-storage.html">
          <script></script>
        `,
        'nested/test.html': `
          <link rel="import" href="../../app-route/app-route.html">
          <script></script>
        `,
        'bower_components/app-storage/app-storage.html': `<h1>Hi</h1>`,
        'bower_components/app-route/app-route.html': `<h1>Hi</h1>`,
      });
      assertSources(
          await convert({
            packageEntrypoints: new Map([
              ['some-package', ['test.html' as OriginalDocumentUrl]],
              ['app-route', ['app-route.html' as OriginalDocumentUrl]],
              ['app-storage', ['app-storage.html' as OriginalDocumentUrl]],
            ]),
          }),
          {
            'test.js': `
import './nested/test.js';
import '../@polymer/app-storage/app-storage.js';
`,
            'nested/test.js': `
import '../../@polymer/app-route/app-route.js';
`,
            'test.html': undefined,
            'nested/test.html': undefined,
          });
    });

    test(
        'converts dependency imports for an element with a scoped package name',
        async () => {
          setSources({
            'test.html': `
          <link rel="import" href="./nested/test.html">
          <link rel="import" href="../app-storage/app-storage.html">
          <script></script>
        `,
            'nested/test.html': `
          <link rel="import" href="../../app-route/app-route.html">
          <script></script>
        `,
            'bower_components/app-route/app-route.html': `<h1>Hi</h1>`,
            'bower_components/app-storage/app-storage.html': `<h1>Hi</h1>`,
          });
          assertSources(
              await convert({
                npmPackageName: '@some-scope/some-package',
                packageEntrypoints: new Map([
                  ['some-package', ['test.html' as OriginalDocumentUrl]],
                  ['app-route', ['app-route.html' as OriginalDocumentUrl]],
                  ['app-storage', ['app-storage.html' as OriginalDocumentUrl]],
                ]),
              }),
              {
                'test.js': `
import './nested/test.js';
import '../../@polymer/app-storage/app-storage.js';
`,
                'nested/test.js': `
import '../../../@polymer/app-route/app-route.js';
`
              });
        });

    test('converts dependency imports for an npm application', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./nested/test.html">
          <link rel="import" href="./bower_components/app-storage/app-storage.html">
          <link rel="import" href="/bower_components/app-route/app-route.html">
          <script></script>
        `,
        'nested/test.html': `
          <link rel="import" href="../bower_components/app-storage/app-storage.html">
          <link rel="import" href="/bower_components/app-route/app-route.html">
          <script></script>
        `,
        'bower_components/app-route/app-route.html': `<h1>Hi</h1>`,
        'bower_components/app-storage/app-storage.html': `<h1>Hi</h1>`,
      });
      assertSources(
          await convert({
            packageType: 'application',
            packageEntrypoints: new Map([
              ['some-package', ['test.html' as OriginalDocumentUrl]],
              ['app-route', ['app-route.html' as OriginalDocumentUrl]],
              ['app-storage', ['app-storage.html' as OriginalDocumentUrl]],
            ]),
          }),
          {
            'test.js': `
import './nested/test.js';
import './node_modules/@polymer/app-storage/app-storage.js';
import '/node_modules/@polymer/app-route/app-route.js';
`,
            'nested/test.js': `
import '../node_modules/@polymer/app-storage/app-storage.js';
import '/node_modules/@polymer/app-route/app-route.js';
`,
          });
    });

    test(
        'converts dependency imports for an npm application with a scoped package name',
        async () => {
          setSources({
            'test.html': `
          <link rel="import" href="./nested/test.html">
          <link rel="import" href="./bower_components/app-storage/app-storage.html">
          <link rel="import" href="/bower_components/app-route/app-route.html">
          <script></script>
        `,
            'nested/test.html': `
          <link rel="import" href="../bower_components/app-storage/app-storage.html">
          <link rel="import" href="/bower_components/app-route/app-route.html">
          <script></script>
        `,
            'bower_components/app-route/app-route.html': `<h1>Hi</h1>`,
            'bower_components/app-storage/app-storage.html': `<h1>Hi</h1>`,
          });
          assertSources(
              await convert({
                packageType: 'application',
                packageEntrypoints: new Map([
                  ['some-package', ['test.html' as OriginalDocumentUrl]],
                  ['app-route', ['app-route.html' as OriginalDocumentUrl]],
                  ['app-storage', ['app-storage.html' as OriginalDocumentUrl]],
                ]),
              }),
              {
                'test.js': `
import './nested/test.js';
import './node_modules/@polymer/app-storage/app-storage.js';
import '/node_modules/@polymer/app-route/app-route.js';
`,
                'nested/test.js': `
import '../node_modules/@polymer/app-storage/app-storage.js';
import '/node_modules/@polymer/app-route/app-route.js';
`,
              });
        });


    test(
        'converts dependency imports for an element using name-style imports',
        async () => {
          setSources({
            'test.html': `
            <link rel="import" href="./nested/test.html">
            <link rel="import" href="../app-storage/app-storage.html">
            <script></script>
          `,
            'nested/test.html': `
            <link rel="import" href="../../app-route/app-route.html">
            <script></script>
          `,
            'bower_components/app-route/app-route.html': `<h1>Hi</h1>`,
            'bower_components/app-storage/app-storage.html': `<h1>Hi</h1>`,
          });
          assertSources(
              await convert({
                npmPackageName: '@some-scope/some-package',
                npmImportStyle: 'name',
                packageEntrypoints: new Map([
                  ['some-package', ['test.html' as OriginalDocumentUrl]],
                  ['app-route', ['app-route.html' as OriginalDocumentUrl]],
                  ['app-storage', ['app-storage.html' as OriginalDocumentUrl]],
                ]),
              }),
              {
                'test.js': `
import './nested/test.js';
import '@polymer/app-storage/app-storage.js';
`,
                'nested/test.js': `
import '@polymer/app-route/app-route.js';
`
              });
        });


    test('converts imports to .js without scripts', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./dep.html">
        `,
        'dep.html': `<h1>Hi</h1>`,
      });
      assertSources(await convert(), {
        'test.js': `
import './dep.js';
`
      });
    });

    test('deletes import wrappers', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./foo.html">
        `,
        'foo.html': `
          <script src="foo.js"></script>
        `,
        'foo.js': `
console.log('foo');
`,
      });
      assertSources(await convert(), {
        'test.js': `
import './foo.js';
`
      });
    });

    test('converts implicit imports to .js', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./foo.html">
          <script>
            console.log(Polymer.foo);
            console.log(Polymer.bar);
          </script>
        `,
        'foo.html': `
          <link rel="import" href="./bar.html">
          <script>
            Polymer.foo = 42;
          </script>
        `,
        'bar.html': `
          <script>
            Polymer.bar = 'Life, Universe, Everything';
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
import { foo } from './foo.js';
import { bar } from './bar.js';
console.log(foo);
console.log(bar);
`
      });
    });

    test('imports namespace itself if called directly', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./foo.html">
          <script>
            console.log(window.Polymer());
            console.log(Polymer());
            console.log(Polymer.foo);
            console.log(Polymer['bar']);
          </script>
        `,
        'foo.html': `
          <script>
            window.Polymer = function() {};
            Polymer.foo = 42;
            Polymer.bar = 43;
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
import { Polymer, foo } from \'./foo.js\';
console.log(Polymer());
console.log(Polymer());
console.log(foo);
console.log(Polymer[\'bar\']);
`
      });
    });

    test('imports namespace itself if called indirectly', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./foo.html">
          <script>
            var P = Polymer;
            var Po = window.Polymer;
            P();
            Po();
          </script>
        `,
        'foo.html': `
          <script>
            window.Polymer = function() {};
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
import { Polymer } from './foo.js';
var P = Polymer;
var Po = Polymer;
P();
Po();
`
      });
    });

    test('imports _polymerFn as Polymer from polymer-fn.js', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./polymer.html">
          <script>
            console.log(window.Polymer());
            console.log(Polymer());
          </script>
        `,
        'polymer.html': `
          <link rel="import" href="./lib/legacy/polymer-fn.html">
        `,
        'lib/legacy/polymer-fn.html': `
          <script>
            window.Polymer._polymerFn = function(info) {
              console.log("hey there, i'm the polymer function!");
            };
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
import './polymer.js';
import { Polymer } from './lib/legacy/polymer-fn.js';
console.log(Polymer());
console.log(Polymer());
`,

        'polymer.js': `
import './lib/legacy/polymer-fn.js';
`,

        'lib/legacy/polymer-fn.js': `
export const Polymer = function(info) {
  console.log("hey there, i\'m the polymer function!");
};
`
      });
    });

    suite('renaming', async () => {
      const suiteName = 'in a package "polymer", renames "/polymer.html" to ' +
          '"/polymer-legacy.js"';
      suite(suiteName, async () => {
        test('with "./" prefix', async () => {
          setSources({
            'test.html': `
          <link rel="import" href="./polymer.html">
          <script>
            console.log(window.Polymer());
            console.log(Polymer());
            console.log(Polymer.foo);
            console.log(Polymer['bar']);
          </script>
        `,
            'polymer.html': `
          <script>
            window.Polymer = function() {};
            Polymer.foo = 42;
            Polymer.bar = 43;
          </script>
        `,
          });
          const options = {
            bowerPackageName: 'polymer',
            npmPackageName: '@polymer/polymer',
            packageEntrypoints: new Map([
              [
                'polymer',
                [
                  'test.html' as OriginalDocumentUrl,
                  'polymer.html' as OriginalDocumentUrl,
                ]
              ],
            ]),
          };
          assertSources(await convert(options), {
            'test.js': `
import { Polymer, foo } from './polymer-legacy.js';
console.log(Polymer());
console.log(Polymer());
console.log(foo);
console.log(Polymer['bar']);
`,
            'polymer-legacy.js': `
export const Polymer = function() {};
export const foo = 42;
export const bar = 43;
`,
          });
        });

        test('without "./" prefix', async () => {
          setSources({
            'test.html': `
          <link rel="import" href="polymer.html">
          <script>
            console.log(window.Polymer());
            console.log(Polymer());
            console.log(Polymer.foo);
            console.log(Polymer['bar']);
          </script>
        `,
            'polymer.html': `
          <script>
            window.Polymer = function() {};
            Polymer.foo = 42;
            Polymer.bar = 43;
          </script>
        `,
          });
          const options = {
            bowerPackageName: 'polymer',
            npmPackageName: '@polymer/polymer',
            packageEntrypoints: new Map([
              [
                'polymer',
                [
                  'test.html' as OriginalDocumentUrl,
                  'polymer.html' as OriginalDocumentUrl,
                ]
              ],
            ]),
          };
          assertSources(await convert(options), {
            'test.js': `
import { Polymer, foo } from './polymer-legacy.js';
console.log(Polymer());
console.log(Polymer());
console.log(foo);
console.log(Polymer['bar']);
`,
            'polymer-legacy.js': `
export const Polymer = function() {};
export const foo = 42;
export const bar = 43;
`,
          });
        });

        const testName =
            'files named "polymer.html" at the root of the package are renamed';
        test(testName, async () => {
          setSources({
            'test.html': `
          <link rel="import" href="some-folder/file-1.html">
          <link rel="import" href="some-folder/file-2.html">
        `,
            // The import in this file has the "./" prefix.
            'some-folder/file-1.html': `
          <link rel="import" href="./polymer.html">
          <script>
            console.log(window.Polymer());
            console.log(Polymer());
            console.log(Polymer.foo);
            console.log(Polymer['bar']);
          </script>
        `,
            // The import in this file does not have the "./" prefix.
            'some-folder/file-2.html': `
          <link rel="import" href="polymer.html">
          <script>
            console.log(window.Polymer());
            console.log(Polymer());
            console.log(Polymer.foo);
            console.log(Polymer['bar']);
          </script>
        `,
            'some-folder/polymer.html': `
          <script>
            window.Polymer = function() {};
            Polymer.foo = 42;
            Polymer.bar = 43;
          </script>
        `,
          });
          const options = {
            bowerPackageName: 'polymer',
            npmPackageName: '@polymer/polymer',
            packageEntrypoints: new Map([
              [
                'polymer',
                [
                  'test.html' as OriginalDocumentUrl,
                  'some-folder/file-1.html' as OriginalDocumentUrl,
                  'some-folder/file-2.html' as OriginalDocumentUrl,
                ]
              ],
            ]),
          };
          assertSources(await convert(options), {
            'test.js': `
import './some-folder/file-1.js';
import './some-folder/file-2.js';
`,
            'some-folder/file-1.js': `
import { Polymer, foo } from './polymer.js';
console.log(Polymer());
console.log(Polymer());
console.log(foo);
console.log(Polymer['bar']);
`,
            'some-folder/file-2.js': `
import { Polymer, foo } from './polymer.js';
console.log(Polymer());
console.log(Polymer());
console.log(foo);
console.log(Polymer['bar']);
`,
            'some-folder/polymer.js': `
export const Polymer = function() {};
export const foo = 42;
export const bar = 43;
`,
          });
        });
      });

      const testName =
          'renames "Polymer.Element" property to "PolymerElement" export';
      test(testName, async () => {
        setSources({
          'test.html': `
              <link rel="import" href="./polymer-element.html">
              <script>
                console.log(Polymer.Element);
              </script>
            `,
          'polymer-element.html': `
              <script>
              const Element = (() => {})();
              Polymer.Element = Element;
            </script>
            `,
        });
        const options = {
          bowerPackageName: 'polymer',
          npmPackageName: '@polymer/polymer',
          packageEntrypoints: new Map([
            [
              'polymer',
              [
                'test.html' as OriginalDocumentUrl,
                'polymer-element.html' as OriginalDocumentUrl,
              ]
            ],
          ]),
        };
        assertSources(await convert(options), {
          'test.js': `
import { PolymerElement } from './polymer-element.js';
console.log(PolymerElement);
`,
          'polymer-element.js': `
const Element = (() => {})();
export { Element as PolymerElement };
`,
        });
      });
    });

    test('unwraps top-level IIFE', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';

              console.log('a statement');
            })();
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
console.log('a statement');
`
      });
    });

    test('removes top-level use-strict', async () => {
      setSources({
        'test.html': `
          <script>
            'use strict';

            console.log('a statement');
            console.log('just do not forget to', 'use strict', 'okay?');
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
console.log('a statement');
console.log('just do not forget to', 'use strict', 'okay?');
`
      });
    });

    test('exports a reference', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';

              Polymer.ArraySelectorMixin = ArraySelectorMixin;
            })();
          </script>`
      });
      assertSources(await convert(), {
        'test.js': `
export { ArraySelectorMixin };
`
      });
    });

    test('exports a value to a nested namespace', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              window.Polymer.version = '2.0.0';
            })();
          </script>`
      });
      assertSources(await convert(), {
        'test.js': `
export const version = '2.0.0';
`
      });
    });

    test('exports the result of a function call', async () => {
      setSources({
        'test.html': `
          <script>
            Polymer.LegacyElementMixin = Polymer.dedupingMixin();
          </script>`
      });
      assertSources(await convert(), {
        'test.js': `
export const LegacyElementMixin = Polymer.dedupingMixin();
`
      });
    });

    test('exports a namespace object\'s properties', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';

              /**
               * @memberof Polymer.Namespace
               */
              function independentFn() {}

              /**
               * @namespace
               * @memberof Polymer
               */
              Polymer.Namespace = {
                literal: 42,
                arr: [],
                obj: {},
                meth() {},
                func: function() {},
                arrow: () => {},
                independentFn: independentFn,
              };
            })();
          </script>`,
      });
      assertSources(await convert(), {
        'test.js': `
/**
 * @memberof Polymer.Namespace
 */
function independentFn() {}

export const literal = 42;
export const arr = [];
export const obj = {};
export function meth() {}
export function func() {}
export const arrow = () => {};
export { independentFn };
`
      });
    });

    test('modifies `this` references correctly for exports', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               * @memberof Polymer
               */
              const Namespace = {
                fn: function() {
                  this.foobar();
                },
                // NOTE: this is not a valid reference to Namespace.foobar
                isArrowFn: () => {
                  this.foobar();
                },
                ifBlock: function() {
                  if (this.foobar) {
                    this.foobar();
                  }
                },
                iffeFn: function() {
                  (function() {
                    this.foobar();
                  })();
                },
                inlineFn: function() {
                  function inline() {
                    this.foobar();
                  }
                  inline();
                },
                arrowFn: function() {
                  const baz = () => {
                    this.foobar();
                  };
                },
              };
              Polymer.Namespace = Namespace;
            })();
          </script>`,
      });
      assertSources(await convert(), {
        'test.js': `
export function fn() {
  foobar();
}

// NOTE: this is not a valid reference to Namespace.foobar
export const isArrowFn = () => {
  this.foobar();
};

export function ifBlock() {
  if (foobar) {
    foobar();
  }
}

export function iffeFn() {
  (function() {
    this.foobar();
  })();
}

export function inlineFn() {
  function inline() {
    this.foobar();
  }
  inline();
}

export function arrowFn() {
  const baz = () => {
    foobar();
  };
}
`
      });
    });

    let testName = 'references to namespace objects are rewritten to ' +
        '`undefined` when they do not start member expressions';
    test(testName, async () => {
      setSources({
        'test.html': `
          <script>
            /** @namespace */
            window.NS = {
              f: function() {
                console.log('f', this);
                this.g();
              },
              g: function() { console.log('g'); },
            };
          </script>`,
      });
      assertSources(await convert(), {
        'test.js': `
export function f() {
  console.log('f', undefined);
  g();
}

export function g() { console.log('g'); }
`
      });
    });



    test(
        'exports a namespace object and fixes local references to its properties',
        async () => {
          setSources({
            'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               */
              Polymer.Namespace = {
                meth() {},
                polymerReferenceFn: function() {
                  return Polymer.Namespace.meth();
                },
                thisReferenceFn: function() {
                  return this.meth();
                },
              };
            })();
          </script>`,
          });
          assertSources(await convert(), {
            'test.js': `
export function meth() {}

export function polymerReferenceFn() {
  return meth();
}

export function thisReferenceFn() {
  return meth();
}
`
          });
        });

    test('exports a mutable reference if set via mutableExports', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               */
              Polymer.Namespace = {
                immutableLiteral: 42,
                mutableLiteral: 0,
                increment() {
                  Polymer.Namespace.mutableLiteral++;
                },
              };
            })();
          </script>`,
      });
      assertSources(await convert(), {
        'test.js': `
export const immutableLiteral = 42;
export let mutableLiteral = 0;

export function increment() {
  mutableLiteral++;
}
`
      });
    });

    test('exports a mutable reference if assigned to', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               */
              Polymer.Namespace = {
                immutableLiteral: 42,
                mutableLiteral: 0,
                increment() {
                  this.mutableLiteral = 5;
                },
              };
            })();
          </script>`,
      });
      assertSources(await convert(), {
        'test.js': `
export const immutableLiteral = 42;
export let mutableLiteral = 0;

export function increment() {
  mutableLiteral = 5;
}
`
      });
    });

    test('exports a mutable function if assigned to', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               */
              Polymer.Namespace = {
                immutableFunction: () => 42,
                mutableFunction: () => 0,
                increment() {
                  this.mutableFunction = () => 5;
                },
              };
            })();
          </script>`,
      });
      assertSources(await convert(), {
        'test.js': `
export const immutableFunction = () => 42;
export let mutableFunction = () => 0;

export function increment() {
  mutableFunction = () => 5;
}
`
      });
    });

    test('exports a namespace function and its properties', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               * @memberof Polymer
               */
              Polymer.dom = function() {
                return 'Polymer.dom result';
              };
              /**
               * @memberof Polymer.dom
               */
              Polymer.dom.subFn = function() {
                return 'Polymer.dom.subFn result';
              };
            })();
          </script>`,
      });
      assertSources(await convert(), {
        'test.js': `
export const dom = function() {
  return 'Polymer.dom result';
};

export const subFn = function() {
  return 'Polymer.dom.subFn result';
};
`
      });
    });

    test('exports mutable properties set imperatively', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               * @memberof Polymer
               */
              Polymer.dom = {};
              /**
               * @memberof Polymer.dom
               */
              Polymer.dom.subFn = function() {
                Polymer.dom.subFn = () => 42;
              };
            })();
          </script>`,
      });
      assertSources(await convert(), {
        'test.js': `
export let subFn = function() {
  subFn = () => 42;
};
`
      });
    });

    testName =
        'exports a namespace function and fixes references to its properties';
    test(testName, async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               * @memberof Polymer
               */
              Polymer.dom = function() {
                return 'Polymer.dom result';
              };
              /**
               * @memberof Polymer.dom
               */
              Polymer.dom.subFn = function() {
                return 'Polymer.dom.subFn result';
              };
              /**
               * @memberof Polymer.dom
               */
              Polymer.dom.subFnDelegate = function() {
                return 'Polymer.dom.subFnDelegate delegates: ' + Polymer.dom() + Polymer.dom.subFn();
              };
            })();
          </script>`,
      });
      assertSources(await convert(), {
        'test.js': `
export const dom = function() {
  return 'Polymer.dom result';
};

export const subFn = function() {
  return 'Polymer.dom.subFn result';
};

export const subFnDelegate = function() {
  return 'Polymer.dom.subFnDelegate delegates: ' + dom() + subFn();
};
`
      });
    });

    test('exports a referenced namespace', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               * @memberof Polymer
               */
              const Namespace = {
                obj: {
                  deepFunc: function() {},
                },
                func: function() {},
                localReferencingFunc: function() {
                  return Namespace.func();
                },
                globalReferencingFunc: function() {
                  return Polymer.Namespace.func();
                },
                thisReferenceFn: function() {
                  this.func();
                },
                deepReferenceFn: function() {
                  this.obj.deepFunc();
                },
              };
              Polymer.Namespace = Namespace;
            })();
          </script>`,
      });
      assertSources(await convert(), {
        'test.js': `
export const obj = {
  deepFunc: function() {},
};

export function func() {}

export function localReferencingFunc() {
  return func();
}

export function globalReferencingFunc() {
  return func();
}

export function thisReferenceFn() {
  func();
}

export function deepReferenceFn() {
  obj.deepFunc();
}
`
      });
    });


    test('specifies referenced imports in import declarations', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./dep.html">
          <script>
            class MyElement extends Polymer.Element {}
          </script>
        `,
        'dep.html': `
          <script>
            Polymer.Element = {};
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
import { PolymerElement } from './dep.js';
class MyElement extends PolymerElement {}
`
      });
    });

    test('uses imports from namespaces', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./dep.html">
          <script>
            class MyElement extends Polymer.Foo.Element {}
          </script>
        `,
        'dep.html': `
          <script>
            /**
             * @namespace
             */
            Polymer.Foo = {
              Element: {},
            };
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
import { Element } from './dep.js';
class MyElement extends Element {}
`
      });
    });

    test('rewrites references to namespaces', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./dep.html">
          <script>
            const Foo = Polymer.Foo;
            class MyElement extends Foo.Element {}
          </script>
        `,
        'dep.html': `
          <script>
            /**
             * @namespace
             */
            Polymer.Foo = {
              Element: {},
            };
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
import * as dep from './dep.js';
const Foo = dep;
class MyElement extends Foo.Element {}
`
      });
    });

    test('handles both named imports and namespace imports', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./dep.html">
          <script>
            const Foo = Polymer.Foo;
            const Bar = Foo.Element;
            const Baz = Polymer.Foo.Element;
          </script>
        `,
        'dep.html': `
          <script>
            /**
             * @namespace
             */
            Polymer.Foo = {
              Element: {},
            };
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
import * as dep from './dep.js';
import { Element as Element$0 } from './dep.js';
const Foo = dep;
const Bar = Foo.Element;
const Baz = Element$0;
`
      });
    });

    test('handles re-exports in namespaces', async () => {
      setSources({
        'test.html': `
          <script>
            /**
             * @namespace
             * @memberof Polymer
             */
            const Path = {
              isPath() {}
            };
            Path.isDeep = Path.isPath;
            Polymer.Path = Path;
          </script>
        `,
      });
      assertSources(await convert(), {
        'test.js': `
export function isPath() {}
export const isDeep = isPath;
`
      });
    });

    test('excludes excluded files', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./exclude.html">
          <link rel="import" href="./dep.html">
          <script>
            class MyElement extends Polymer.Element {}
          </script>
        `,
        'dep.html': `
          <script>
            Polymer.Element = {};
          </script>
        `,
        'exclude.html': `
          <script>"no no no";</script>
        `,
      });
      assertSources(
          await convert({
            namespaces: ['Polymer'],
            excludes: ['exclude.html'],
          }),
          {
            'test.js': `
import { PolymerElement } from './dep.js';
class MyElement extends PolymerElement {}
`
          });
    });

    test('excludes excluded references', async () => {
      setSources({
        'test.html': `
          <script>
            if (Polymer.DomModule) {}
          </script>
        `,
      });
      assertSources(
          await convert({
            namespaces: ['Polymer'],
            referenceExcludes: ['Polymer.DomModule']
          }),
          {
            'test.js': `
if (undefined) {}
`
          });
    });

    test('handles excluded exported references', async () => {
      setSources({
        'test.html': `
          <script>
            Polymer.Settings = settings;
          </script>
        `,
      });
      assertSources(
          await convert({
            namespaces: ['Polymer'],
            referenceExcludes: ['Polymer.Settings'],
          }),
          {
            'test.js': `
export { settings as Settings };
`
          });
    });

    test.skip('handles excluded local namespace references', async () => {
      setSources({
        'test.html': `
          <script>
            let rootPath;

            /**
             * @memberof Polymer
             */
            Polymer.rootPath = rootPath;

            /**
             * @memberof Polymer
             */
            Polymer.setRootPath = function(path) {
              Polymer.rootPath = path;
            }
          </script>
        `,
      });
      assertSources(
          await convert({
            namespaces: ['Polymer'],
            referenceExcludes: ['Polymer.rootPath'],
          }),
          {
            'test.js': `
let rootPath;
export { rootPath };
export const setRootPath = function(path) {
  rootPath = path;
};
`
          });
    });

    test('inlines templates into class-based Polymer elements', async () => {
      setSources({
        'html-tag.html': `
            <script>
              /**
               * @memberof Polymer
               */
              Polymer.html = function() {};
            </script>`,
        'polymer.html': `
            <link rel="import" href="./html-tag.html">
            <script>
              /** @namespace */
              const Polymer = {};
              /** @memberof Polymer */
              Polymer.Element = class Element {}
            </script>`,
        'test.html': `
<link rel="import" href="./polymer.html">
<dom-module id="test-element">
  <template>
    <h1>Hi!</h1>
    <div>
      This template has multiple lines.<br>
      This template contains duplicated special characters: \` \$ \` \$
    </div>
  </template>
  <script>
    /**
     * @customElement
     * @polymer
     */
    class TestElement extends Polymer.Element {
      static get is() { return 'test-element'; }
    }
  </script>
</dom-module>
`,
      });
      assertSources(await convert(), {
        'test.js': `
import { PolymerElement } from './polymer.js';
import { html } from './html-tag.js';
/**
 * @customElement
 * @polymer
 */
class TestElement extends PolymerElement {
  static get template() {
    return html\`
    <h1>Hi!</h1>
    <div>
      This template has multiple lines.<br>
      This template contains duplicated special characters: \\\` \\$ \\\` \\$
    </div>
\`;
  }

  static get is() { return 'test-element'; }
}
`
      });
    });

    test('inlines templates into factory-based Polymer elements', async () => {
      setSources({
        'html-tag.html': `
            <script>
              /**
               * @memberof Polymer
               */
              Polymer.html = function() {};
            </script>`,
        'polymer.html': `
            <link rel="import" href="./html-tag.html">
            <script>
              /** @global */
              window.Polymer = function() {}
            </script>`,
        'test.html': `
  <link rel="import" href="./polymer.html">
  <dom-module id="test-element">
    <template>
      <h1>Hi!</h1>
    </template>
    <script>
      Polymer({
        is: 'test-element',
      });
    </script>
  </dom-module>
`,
      });

      assertSources(await convert(), {
        'test.js': `
import { Polymer } from './polymer.js';
import { html } from './html-tag.js';
Polymer({
  _template: html\`
      <h1>Hi!</h1>
\`,

  is: 'test-element'
});
`
      });
    });

    test('adds importMeta to class-based Polymer elements', async () => {
      setSources({
        'test.html': `
<script>
  /**
   * @customElement
   * @polymer
   */
  class TestElement extends Polymer.Element {
  }
</script>
`,
      });
      assertSources(
          await convert({
            addImportMeta: true,
          }),
          {
            'test.js': `
/**
 * @customElement
 * @polymer
 */
class TestElement extends Polymer.Element {
  static get importMeta() {
    return import.meta;
  }
}
`
          });
    });

    test('adds importMeta to class-based Polymer elements', async () => {
      setSources({
        'test.html': `
<script>
  Polymer({
  });
</script>
`,
      });

      assertSources(
          await convert({
            addImportMeta: true,
          }),
          {
            'test.js': `
Polymer({
  importMeta: import.meta
});
`
          });
    });

    test('converts arbitrary elements', async () => {
      setSources({
        'test.html': `
<custom-style><style>foo{}</style></custom-style>
<link rel="import" href="./foo.html">
`,
        'foo.html': `<div>hello world!</div>`
      });
      assertSources(await convert(), {
        'test.js': `
import './foo.js';
const $_documentContainer = document.createElement('template');
$_documentContainer.innerHTML = \`<custom-style><style>foo{}</style></custom-style>\`;
document.head.appendChild($_documentContainer.content);
`,
        'foo.js': `
const $_documentContainer = document.createElement('template');
$_documentContainer.innerHTML = \`<div>hello world!</div>\`;
document.head.appendChild($_documentContainer.content);
`
      });
    });

    test('converts multiple namespaces', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./qux.html">
          <script>
            Foo.bar = 10;
            Baz.zug = Foo.qux;
          </script>
        `,
        'qux.html': `<script>Foo.qux = 'lol';</script>`
      });
      assertSources(await convert({namespaces: ['Foo', 'Baz']}), {
        'test.js': `
import { qux } from './qux.js';
export const bar = 10;
export { qux as zug };
`
      });
    });

    test('converts declared namespaces', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./polymer.html">
          <script>
            class Element extends Polymer.Element {};
          </script>
        `,
        'polymer.html': `
          <script>
            /** @namespace */
            const Polymer = {};
            Polymer.Element = class Element {}
          </script>
        `
      });
      assertSources(
          await convert({namespaces: [/* No explicit namespaces! */]}), {
            'test.js': `
import { PolymerElement } from './polymer.js';
class Element extends PolymerElement {}
`,

            'polymer.js': `
export const PolymerElement = class Element {};
`
          });
    });

    test('converts declared nested namespaces', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./ns.html">
          <script>
            class Element extends NS.SubSpace.Element {};
          </script>
        `,
        'ns.html': `
          <script>
            /** @namespace */
            const NS = {};
            /** @namespace */
            NS.SubSpace = {};
            NS.SubSpace.Element = class Element {}
          </script>
        `
      });
      assertSources(
          await convert({namespaces: [/* No explicit namespaces! */]}), {
            'test.js': `
import { Element as Element$0 } from './ns.js';
class Element extends Element$0 {}
`,

            'ns.js': `
export const Element = class Element {};
`
          });
    });

    test(
        'correctly handles top-level html imports when import style=path',
        async () => {
          setSources({
            'test.html': `
                <script>
                  Polymer.Element = class Element {};
                </script>`,
            'index.html': `
                <link rel="import" href="./test.html">
                <link rel="import" href="../shadycss/a.html">
                <script src="../shadycss/b.js"></script>

                <div>Hello world!</div>`,
            'bower_components/shadycss/a.html': ``,
            'bower_components/shadycss/b.js': ``,
          });
          assertSources(
              await convert({
                npmImportStyle: 'path',
                packageEntrypoints: new Map([
                  ['some-package', ['test.html' as OriginalDocumentUrl]],
                  [
                    'shadycss',
                    [
                      'a.html' as OriginalDocumentUrl,
                      'b.js' as OriginalDocumentUrl
                    ]
                  ],
                ]),
              }),
              {
                'test.js': `
export const PolymerElement = class Element {};
`,

                'index.html': `

                <script type="module" src="./test.js"></script>
                <script type="module" src="../@webcomponents/shadycss/a.js"></script>
                <script src="../@webcomponents/shadycss/b.js"></script>

                <div>Hello world!</div>`
              });
        });


    test(
        'correctly handles top-level html imports when import style=name',
        async () => {
          setSources({
            'test.html': `
                <script>
                  Polymer.Element = class Element {};
                </script>`,
            'index.html': `
                <link rel="import" href="./test.html">
                <link rel="import" href="../shadycss/a.html">
                <script src="../shadycss/b.js"></script>

                <div>Hello world!</div>`,
            'bower_components/shadycss/a.html': ``,
            'bower_components/shadycss/b.js': ``,
          });
          assertSources(
              await convert({
                npmImportStyle: 'name',
                packageEntrypoints: new Map([
                  ['some-package', ['test.html' as OriginalDocumentUrl]],
                  [
                    'shadycss',
                    [
                      'a.html' as OriginalDocumentUrl,
                      'b.js' as OriginalDocumentUrl
                    ]
                  ],
                ]),
              }),
              {
                'test.js': `
export const PolymerElement = class Element {};
`,

                'index.html': `

                <script type="module" src="./test.js"></script>
                <script type="module" src="../@webcomponents/shadycss/a.js"></script>
                <script src="../@webcomponents/shadycss/b.js"></script>

                <div>Hello world!</div>`
              });
        });

    test('converts multiple scripts in one html file', async () => {
      setSources({
        'test.html': `
<link rel="import" href="./polymer.html">
<script>
  class FooElem extends Polymer.Element {};
</script>
<script>
  class BarElem extends Polymer.Element {};
</script>
`,
        'polymer.html': `
<script>
  Polymer.Element = class Element {};
</script>
`
      });
      assertSources(await convert(), {
        'test.js': `
import { PolymerElement } from './polymer.js';
class FooElem extends PolymerElement {}
class BarElem extends PolymerElement {}
`
      });
    });

    test('converts interspersed html and scripts', async () => {
      setSources({
        'test.html': `
<link rel="import" href="./polymer.html">
<div>Top</div>
<script>
  class FooElem extends Polymer.Element {};
</script>
<div>Middle</div>
<script>
  class BarElem extends Polymer.Element {};
</script>
<div>Bottom</div>
`,
        'polymer.html': `
<script>
  Polymer.Element = class Element {};
</script>
`
      });
      assertSources(await convert(), {
        'test.js': `
import { PolymerElement } from './polymer.js';
const $_documentContainer = document.createElement('template');
$_documentContainer.innerHTML = \`<div>Top</div><div>Middle</div><div>Bottom</div>\`;
document.head.appendChild($_documentContainer.content);
class FooElem extends PolymerElement {}
class BarElem extends PolymerElement {}
`
      });
    });

    test('converts multiple elements with templates in a file', async () => {
      setSources({
        'test.html': `
<link rel="import" href="./polymer.html">
<dom-module id="foo-elem">
  <template>
    <div>foo-element body</div>
  </template>
</dom-module>
<script>
  customElements.define('foo-elem', class FooElem extends Polymer.Element {});
</script>
<dom-module id="bar-elem">
  <template>
    <div>bar body</div>
  </template>
  <script>
    customElements.define('bar-elem', class BarElem extends Polymer.Element {});
  </script>
</dom-module>
<div>Random footer</div>
`,
        'polymer.html': `
<script>
  Polymer.Element = class Element {};
</script>
`
      });
      assertSources(await convert(), {
        'test.js': `
import { PolymerElement } from './polymer.js';
const $_documentContainer = document.createElement('template');
$_documentContainer.innerHTML = \`<div>Random footer</div>\`;
document.head.appendChild($_documentContainer.content);
customElements.define('foo-elem', class FooElem extends PolymerElement {
  static get template() {
    return Polymer.html\`
    <div>foo-element body</div>
\`;
  }
});
customElements.define('bar-elem', class BarElem extends PolymerElement {
  static get template() {
    return Polymer.html\`
    <div>bar body</div>
\`;
  }
});
`
      });
    });

    test('writes new imports as relative from the source file', async () => {
      setSources({
        'subdir/element.html': `
          <link rel="import" href="../lib.html">
        `,
        'subdir/index.html': `
          <link rel="import" href="../lib.html">
          <link rel="import" href="./element.html">
        `,
        'lib.html': `
          <script>
            Polymer.Element = class Element {};
          </script>
        `
      });
      assertSources(await convert(), {
        'subdir/element.js': `
import '../lib.js';
`,

        'subdir/index.html': `

          <script type="module" src="../lib.js"></script>
          <script type="module" src="./element.js"></script>
        `
      });
    });

    test('converts scripts in preserved html properly', async () => {
      setSources({
        'index.html': `
          <div>This is some html.</div>
          <link rel="import" href="./polymer.html">
          <script>
            document.registerElement(
              'foo-elem', class FooElem extends Polymer.Element {});
          </script>
          <script type="module">
            // this should not be changed because it is a module already
            document.registerElement(
              'bar-elem', class BarElem extends HTMLElement {});
          </script>
          <script>
            document.registerElement(
              'baz-elem', class BazElem extends Polymer.Element {});
          </script>
        `,
        'polymer.html': `
            <script>
              Polymer.Element = class Element {};
            </script>
        `
      });
      assertSources(await convert(), {
        'polymer.js': `
export const PolymerElement = class Element {};
`,

        'index.html': `

          <div>This is some html.</div>
          <script type="module" src="./polymer.js"></script>
          <script type="module">
import { PolymerElement } from './polymer.js';
document.registerElement(
  'foo-elem', class FooElem extends PolymerElement {});
</script>
          <script type="module">
            // this should not be changed because it is a module already
            document.registerElement(
              'bar-elem', class BarElem extends HTMLElement {});
          </script>
          <script type="module">
import { PolymerElement } from './polymer.js';
document.registerElement(
  'baz-elem', class BazElem extends PolymerElement {});
</script>
        `,
      });
    });

    test(`don't transform scripts that do not need it`, async () => {
      setSources({
        'index.html': `
          <div>This is some html.</div>
          <script>
            document.registerElement(
              'foo-elem', class FooElem extends HTMLElement {});
          </script>
        `
      });
      assertSources(await convert(), {
        'index.html': `

          <div>This is some html.</div>
          <script>
            document.registerElement(
              'foo-elem', class FooElem extends HTMLElement {});
          </script>
        `,
      });
    });

    test(`handles document.currentScript.ownerDocument`, async () => {
      setSources({
        'test.html': `
          <script>
            console.log(document.currentScript.ownerDocument);
            console.log(
              window.document.currentScript.ownerDocument.querySelectorAll(
                'div'));
            console.log(foo.document.currentScript.ownerDocument);
          </script>
        `
      });
      assertSources(await convert(), {
        'test.js': `
console.log(window.document);
console.log(
  window.document.querySelectorAll(
    'div'));
console.log(foo.document.currentScript.ownerDocument);
`
      });
    });

    testName = `handles imports that are modules but write to globals`;
    test(testName, async () => {
      setSources({
        'test.html': `
          <link rel="import" href="../shadycss/custom-style-interface.html">
          <link rel="import" href="../shadycss/apply-shim.html">
          <script>
            console.log(ShadyCSS.flush());
          </script>
        `,
        'index.html': `
          <link rel="import" href="../shadycss/custom-style-interface.html">
          <link rel="import" href="../shadycss/apply-shim.html">
          <script>
            console.log(ShadyCSS.flush());
          </script>
        `,
        'bower_components/shadycss/custom-style-interface.html': ``,
        'bower_components/shadycss/apply-shim.html': ``,
      });

      assertSources(
          await convert({
            packageEntrypoints: new Map([
              ['some-package', ['test.html' as OriginalDocumentUrl]],
              [
                'shadycss',
                [
                  'custom-style-interface.html' as OriginalDocumentUrl,
                  'apply-shim.html' as OriginalDocumentUrl
                ],
              ],
            ]),
          }),
          {
            'test.js': `
import '../@webcomponents/shadycss/entrypoints/custom-style-interface.js';
import '../@webcomponents/shadycss/entrypoints/apply-shim.js';
console.log(ShadyCSS.flush());
`,

            'index.html': `

          <script type="module" src="../@webcomponents/shadycss/entrypoints/custom-style-interface.js"></script>
          <script type="module" src="../@webcomponents/shadycss/entrypoints/apply-shim.js"></script>
          <script type="module">
import '../@webcomponents/shadycss/entrypoints/custom-style-interface.js';
import '../@webcomponents/shadycss/entrypoints/apply-shim.js';
console.log(ShadyCSS.flush());
</script>
        `
          });
    });

    testName = `handles inline scripts that write to global configuration ` +
        `properties`;
    test(testName, async () => {
      setSources({
        'index.html': `
          <script>
            window.ShadyDOM = {force: true};
          </script>
          <script>
            Polymer = {
              rootPath: 'earlyRootPath/'
            }
          </script>
          <link rel="import" href="../shadycss/custom-style-interface.html">
          <link rel="import" href="../shadycss/apply-shim.html">
          <script>
            console.log(ShadyDOM.flush());
          </script>
        `,
        'bower_components/shadycss/custom-style-interface.html': ``,
        'bower_components/shadycss/apply-shim.html': ``,
      });

      assertSources(
          await convert({
            packageEntrypoints: new Map([
              ['some-package', ['test.html' as OriginalDocumentUrl]],
              [
                'shadycss',
                [
                  'custom-style-interface.html' as OriginalDocumentUrl,
                  'apply-shim.html' as OriginalDocumentUrl
                ],
              ],
            ]),
          }),
          {
            'index.html': `

          <script>
            window.ShadyDOM = {force: true};
          </script>
          <script>
            Polymer = {
              rootPath: 'earlyRootPath/'
            }
          </script>
          <script type="module" src="../@webcomponents/shadycss/entrypoints/custom-style-interface.js"></script>
          <script type="module" src="../@webcomponents/shadycss/entrypoints/apply-shim.js"></script>
          <script type="module">
import '../@webcomponents/shadycss/entrypoints/custom-style-interface.js';
import '../@webcomponents/shadycss/entrypoints/apply-shim.js';
console.log(ShadyDOM.flush());
</script>
        `
          });
    });

    testName =
        `finds the right element declaration to associate the template with`;
    test(testName, async () => {
      setSources({
        'test.html': `
<dom-module id="foo"><template>foo</template></dom-module>
<script>
  Polymer({
    is: 'foo'
  });
</script>

<dom-module id="bar"><template>bar</template></dom-module>
<script>
  Polymer({
    is: 'bar'
  });
</script>
        `
      });
      assertSources(await convert(), {
        'test.js': `
Polymer({
  _template: Polymer.html\`
foo
\`,

  is: 'foo'
});
Polymer({
  _template: Polymer.html\`
bar
\`,

  is: 'bar'
});
`
      });
    });

    testName = `convert namespace assignments on maintained inline scripts`;
    test(testName, async () => {
      setSources({
        'index.html': `
          <link rel="import" href="./polymer.html">
          <script>
            Polymer.foo = class Foo {foo() {}};
            new Polymer.foo().foo();
          </script>
        `,
        'polymer.html': `
          <script>
            /** @namespace */
            const Polymer = {};
          </script>
        `
      });

      assertSources(await convert(), {
        'index.html': `

          <script type="module" src="./polymer.js"></script>
          <script type="module">
import './polymer.js';
export const foo = class Foo {foo() {}};
new foo().foo();
</script>
        `,
        'polymer.js': `

`
      });
    });

    test(`convert writes into setter calls`, async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./settings.html">

          <script>
            Polymer.foo = 'hello';
            window.Polymer.bar.baz = Polymer.foo + 10 * 10 ** 10;
          </script>
        `,
        'settings.html': `
          <script>
            Polymer.foo = 'default';
            Polymer.setFoo = function(newFoo) {
              Polymer.foo = newFoo;
            }

            /** @namespace */
            Polymer.bar = {
              baz: 100,
              setBaz: function(newBaz) {
                this.baz = newBaz;
              }
            };
          </script>
        `
      });

      assertSources(await convert(), {
        'settings.js': `
export let foo = 'default';

export const setFoo = function(newFoo) {
  foo = newFoo;
};

export let baz = 100;

export function setBaz(newBaz) {
  baz = newBaz;
}
`,

        'test.js': `
import { setFoo, setBaz, foo } from './settings.js';
setFoo('hello');
setBaz(foo + 10 * (10 ** 10));
`,
      });
    });

    // TODO: Fix (or remove) package url handling to properly scan dependencies
    // as seperate packages.
    test.skip(`handle when two dependencies claim the same export`, async () => {
      setSources({
        'test.html': `
          <link rel="import" href="../app-storage/app-storage.html">
          <script>
            console.log(Polymer.foo);
          </script>
        `,
        'test2.html': `
          <link rel="import" href="../app-route/app-route.html">
          <script>
            console.log(Polymer.foo);
          </script>
        `,
        'bower_components/app-storage/app-storage.html': `
          <script>
            Polymer.foo = 'hello, app-storage';
          </script>
        `,
        'bower_components/app-route/app-route.html': `
          <script>
            Polymer.foo = 'hello, app-route';
          </script>
        `,
      });

      assertSources(
          await convert({
            packageEntrypoints: new Map([
              [
                'some-package',
                [
                  'test.html' as OriginalDocumentUrl,
                  'test2.html' as OriginalDocumentUrl,
                ]
              ],
              [
                'app-storage',
                [
                  'bower_components/app-storage/app-storage.html' as
                      OriginalDocumentUrl,
                ]
              ],
              [
                'app-route',
                [
                  'bower_components/app-route/app-route.html' as
                      OriginalDocumentUrl,
                ]
              ],
            ]),
            expectedWarnings: [
              'CONFLICT: JS Export Polymer.foo claimed by two packages: ./node_modules/@polymer/app-route/app-route.js & ./node_modules/@polymer/app-storage/app-storage.js',
              'CONFLICT: JS Export Polymer.foo claimed by two packages: ./node_modules/@polymer/app-route/app-route.js & ./node_modules/@polymer/app-storage/app-storage.js',
            ]
          }),
          {
            'test.js': `
import '../@polymer/app-storage/app-storage.js';
import { foo } from '../@polymer/app-route/app-route.js';
console.log(foo);
`,
            'test2.js': `
import { foo } from '../@polymer/app-route/app-route.js';
console.log(foo);
`,
          });
    });

    testName = `we convert urls of external scripts in html to html transforms`;
    test(testName, async () => {
      setSources({
        'index.html': `
          <script src="../foo/foo.js"></script>
        `,
        'bower_components/foo/foo.js': `
          console.log('hello world');
        `
      });
      let expectedWarnings = [`WARN: bower->npm mapping for "foo" not found`];
      assertSources(
          await convert({
            expectedWarnings,
            packageEntrypoints: new Map([
              [
                'some-package',
                [/* index.html not included: it is not an HTML import */]
              ],
              ['foo', ['foo.js' as OriginalDocumentUrl]],
            ]),
          }),
          {
            'index.html': `

          <script src="../foo/foo.js"></script>
        `,
          });
      // Warnings are memoized, duplicates are not expected
      expectedWarnings = [];
      assertSources(
          await convert({
            bowerPackageName: 'polymer',
            npmPackageName: '@polymer/polymer',
            packageEntrypoints: new Map([
              ['polymer', []],
              ['foo', ['foo.js' as OriginalDocumentUrl]],
            ]),
            expectedWarnings
          }),
          {
            'index.html': `

          <script src="../../foo/foo.js"></script>
        `,
          });
    });

    test(`remove WebComponentsReady`, async () => {
      setSources({
        'test.html': `
          <script>
            addEventListener('WebComponentsReady', () => {
              class XFoo extends HTMLElement {
                connectedCallback() {
                  this.spy = sinon.spy(window.ShadyCSS, 'styleElement');
                  super.connectedCallback();
                  this.spy.restore();
                }
              }
              customElements.define('x-foo', XFoo);

            });

            HTMLImports.whenReady(function() {
              Polymer({
                is: 'data-popup'
              });
            });
          </script>
        `,
      });

      assertSources(
          await convert({
            bowerPackageName: 'polymer',
            npmPackageName: '@polymer/polymer',
            packageEntrypoints: new Map([
              ['polymer', ['test.html' as OriginalDocumentUrl]],
            ]),
          }),
          {
            'test.js': `
class XFoo extends HTMLElement {
  connectedCallback() {
    this.spy = sinon.spy(window.ShadyCSS, 'styleElement');
    super.connectedCallback();
    this.spy.restore();
  }
}
customElements.define('x-foo', XFoo);

Polymer({
  is: 'data-popup'
});
`,
          });
    });

    test(`clones unclaimed dom-modules, leaves out scripts`, async () => {
      setSources({
        'test.html': `
          <dom-module>
            <template>
              Scripts in here are cloned
              <script>foo</script>
            </template>
            <script>// this is not cloned</script>
          </dom-module>
        `,
      });

      assertSources(
          await convert({
            bowerPackageName: 'polymer',
            npmPackageName: '@polymer/polymer',
            packageEntrypoints: new Map([
              ['polymer', ['test.html' as OriginalDocumentUrl]],
            ]),
          }),
          {
            'test.js': `
const $_documentContainer = document.createElement('template');

$_documentContainer.innerHTML = \`<dom-module>
            <template>
              Scripts in here are cloned
              <script>foo&lt;/script>
            </template>
` +
                '            ' +
                `
          </dom-module>\`;

document.head.appendChild($_documentContainer.content);
`,
          });
    });

    testName =
        'Import aliases do not conflict with local identifiers or other imports.';
    test(testName, async () => {
      setSources({
        'NS1-foo.html': `
            <script>
              NS1.foo = "NS1.foo";
            </script>
          `,
        'NS2-foo.html': `
            <script>
              NS2.foo = "NS2.foo";
            </script>
          `,
        'NS3-foo.html': `
            <script>
              NS3.foo = "NS3.foo";
            </script>
          `,
        'test.html': `
            <link rel="import" href="./NS1-foo.html">
            <link rel="import" href="./NS2-foo.html">
            <link rel="import" href="./NS3-foo.html">
            <script>
              var foo = "foo";
              var foo$1 = "foo$1";
              var foo$2 = "foo$2";
              // Log local variables.
              console.log(foo);
              console.log(foo$1);
              console.log(foo$2);
              // Log imports.
              console.log(NS1.foo);
              console.log(NS2.foo);
              console.log(NS3.foo);
            </script>
          `,
      });
      assertSources(await convert({namespaces: ['NS1', 'NS2', 'NS3']}), {
        'test.js': `
import { foo as foo$0 } from './NS1-foo.js';
import { foo as foo$3 } from './NS2-foo.js';
import { foo as foo$4 } from './NS3-foo.js';
var foo = "foo";
var foo$1 = "foo$1";
var foo$2 = "foo$2";
// Log local variables.
console.log(foo);
console.log(foo$1);
console.log(foo$2);
// Log imports.
console.log(foo$0);
console.log(foo$3);
console.log(foo$4);
`
      });
    });

    test('styles are not converted to imperative code by default', async () => {
      setSources({
        'index.html': `
          <style>
            body { color: red; }
          </style>
          <custom-style>
            <style is="custom-style">
              body { background-color: var(--happy, yellow); }
            </style>
          </custom-style>
        `
      });
      assertSources(await convert(), {
        'index.html': `

          <style>
            body { color: red; }
          </style>
          <custom-style>
            <style is="custom-style">
              body { background-color: var(--happy, yellow); }
            </style>
          </custom-style>
        `
      });
    });
    testName = 'when there is a style import, ' +
        'all inline styles and body elements are converted to imperative scripts';
    test(testName, async () => {
      setSources({
        'index.html': `
          <style>
            body { color: red; }
          </style>
          <style is="custom-style" include="foo-bar">
            body { font-size: 10px; }
          </style>
          <custom-style>
            <style is="custom-style">
              body { background-color: var(--happy, yellow); }
            </style>
          </custom-style>
          <foo-elem></foo-elem>
        `
      });
      assertSources(await convert(), {
        'index.html': `

          <!-- FIXME(polymer-modulizer):
        These imperative modules that innerHTML your HTML are
        a hacky way to be sure that any mixins in included style
        modules are ready before any elements that reference them are
        instantiated, otherwise the CSS @apply mixin polyfill won't be
        able to expand the underlying CSS custom properties.
        See: https://github.com/Polymer/polymer-modulizer/issues/154
        -->
    <script type="module">
const $_documentContainer = document.createElement('template');

$_documentContainer.innerHTML = \`<style>
            body { color: red; }
          </style>\`;

document.head.appendChild($_documentContainer.content);
</script>
          <script type="module">
const $_documentContainer = document.createElement('template');

$_documentContainer.innerHTML = \`<style is="custom-style" include="foo-bar">
            body { font-size: 10px; }
          </style>\`;

document.head.appendChild($_documentContainer.content);
</script>
          <script type="module">
const $_documentContainer = document.createElement('template');

$_documentContainer.innerHTML = \`<custom-style>
            <style is="custom-style">
              body { background-color: var(--happy, yellow); }
            </style>
          </custom-style>\`;

document.body.appendChild($_documentContainer.content);
</script>
          <script type="module">
const $_documentContainer = document.createElement('template');
$_documentContainer.innerHTML = \`<foo-elem></foo-elem>\`;
document.body.appendChild($_documentContainer.content);
</script>
        `
      });
    });

    test('accessing properties on exports is supported', async () => {
      setSources({
        'test.html': `
<script>

  (function() {

    function IronMeta() {}

    Polymer.IronMeta = IronMeta;

    var metaDatas = Polymer.IronMeta.types;
  })();
</script>
`
      });

      assertSources(await convert(), {
        'test.js': `
function IronMeta() {}

export { IronMeta };

var metaDatas = IronMeta.types;
`
      });
    });

    test('Internal imported scripts get inlined into a module', async () => {
      setSources({
        'test.html': `
          <script src='foo.js'></script>
        `,
        'foo.js': 'console.log("foo");'
      });

      assertSources(await convert(), {
        'test.js': `
console.log("foo");
`
      });
    });


    test(
        'External imported scripts do not get inlined into a module',
        async () => {
          setSources({
            'test.html': `
          <script src='../dep/dep.js'></script>
        `,
            'bower_components/dep/dep.js': 'console.log("foo");'
          });

          assertSources(
              await convert({
                packageEntrypoints: new Map([
                  ['some-package', ['test.html' as OriginalDocumentUrl]],
                  ['dep', ['dep.html' as OriginalDocumentUrl]],
                ]),
              }),
              {
                'test.js': `
import '../dep/dep.js';
`
              });
        });

    testName = `don't treat all values on a namespace as namespaces themselves`;
    test(testName, async () => {
      setSources({
        'test.html': `
          <script>
            Polymer.IronSelection = function() {};
            Polymer.IronSelection.prototype = {};
          </script>
`
      });

      assertSources(await convert(), {
        'test.js': `
export const IronSelection = function() {};
IronSelection.prototype = {};
`
      });
    });

    testName = `deal with initializing a namespace by self-assignment`;
    test(testName, async () => {
      setSources({
        'test.html': `
          <script>
            /** @namespace */
            var NS1 = NS1 || {};
            /** @namespace */
            window.NS2 = window.NS2 || {};
            /** @namespace */
            NS2.SubNS = window.NS2.SubNS || {};

            NS2.SubNS.foo = 10;
          </script>
`
      });

      assertSources(await convert(), {
        'test.js': `
export const foo = 10;
`
      });
    });

    testName = `deal with cyclic dependency graphs`;
    test(testName, async () => {
      setSources({
        'a.html': `
          <link rel="import" href="./b.html">
          <script>
            Polymer.foo = 5;
          </script>
        `,
        'b.html': `
          <link rel="import" href="./a.html">
          <script>
            Polymer.bar = 20;
          </script>
        `,
      });
      assertSources(
          await convert({
            packageEntrypoints: new Map([
              ['some-package', ['a.html' as OriginalDocumentUrl]],
            ]),
          }),
          {
            'a.js': `
import './b.js';
export const foo = 5;
`,
            'b.js': `
import './a.js';
export const bar = 20;
`
          });
    });

    testName = `Deal with cyclic references`;
    test(testName, async () => {
      setSources({
        'a.html': `
          <link rel="import" href="./b.html">
          <script>
            Polymer.foo = function() {
              return Polymer.bar || 10;
            }
          </script>
        `,
        'b.html': `
          <link rel="import" href="./a.html">
          <script>
            Polymer.bar = (function() {
              if (Polymer.foo) {
                return 50;
              }
              return 5;
            })();
          </script>
      `
      });
      assertSources(
          await convert({
            packageEntrypoints: new Map([
              ['some-package', ['a.html' as OriginalDocumentUrl]],
            ]),
          }),
          {
            'a.js': `
import { bar } from './b.js';

export const foo = function() {
  return bar || 10;
};
`,
            'b.js': `
import { foo } from './a.js';

export const bar = (function() {
  if (foo) {
    return 50;
  }
  return 5;
})();
`,
          });
    });

    testName = `don't inline nonstandard dom-modules`;
    test(testName, async () => {
      setSources({
        'test.html': `
          <dom-module id="dom-module-attr" attr></dom-module>
          <dom-module id="just-fine">
            <template>Hello world</template>
          </dom-module>
          <dom-module id="multiple-templates">
            <template></template>
            <template></template>
          </dom-module>
          <script>
            customElements.define(
                'dom-module-attr', class extends HTMLElement{});
            customElements.define(
                'just-fine', class extends HTMLElement{});
            customElements.define(
                'multiple-templates', class extends HTMLElement{});
          </script>
        `
      });
      assertSources(await convert(), {
        'test.js': `
const $_documentContainer = document.createElement('template');

$_documentContainer.innerHTML = \`<dom-module id="dom-module-attr" attr=""></dom-module><dom-module id="multiple-templates">
            <template></template>
            <template></template>
          </dom-module>\`;

document.head.appendChild($_documentContainer.content);
customElements.define(
    'dom-module-attr', class extends HTMLElement{});
customElements.define(
    'just-fine', class extends HTMLElement{
  static get template() {
    return Polymer.html\`
Hello world
\`;
  }
});
customElements.define(
    'multiple-templates', class extends HTMLElement{});
`,
      });
    });

    testName = `rewrite toplevel 'this' to 'window'`;
    test(testName, async () => {
      setSources({
        'test.html': `
          <script>
            console.log(this);
            function foo() {
              console.log(this);
            }
            class Foo {
              constructor() {
                this.bar = 10;
              }
            }
            if (this) {
              this;
            }
          </script>
          <script>
            'use strict';
            console.log(this);
          </script>
        `
      });

      assertSources(await convert(), {
        'test.js': `
console.log(window);
function foo() {
  console.log(this);
}
class Foo {
  constructor() {
    this.bar = 10;
  }
}
if (window) {
  window;
}
console.log(this);
`,
      });
    });

    testName = `convert scripts inside demo snippet scripts`;
    test(testName, async () => {
      setSources({
        'index.html': `
          <link rel="import" href="./polymer.html">
          <demo-snippet>
            <template>
              <script>
                console.log(Polymer.foo);
              </script>
            </template>
          </demo-snippet>
        `,
        'polymer.html': `
          <script>
            /** @namespace */
            const Polymer = {};
            Polymer.foo = 10;
          </script>
        `
      });

      assertSources(await convert(), {
        'index.html': `

          <script type="module" src="./polymer.js"></script>
          <demo-snippet>
            <template>
              <script type="module">
import { foo } from './polymer.js';
console.log(foo);
</script>
            </template>
          </demo-snippet>
        `,
      });
    });

    testName = `Unwrap multiple IIFEs`;
    test(testName, async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              console.log('one');
            })();
            (function() {
              console.log('two');
            })();
          </script>
        `
      });

      assertSources(await convert(), {
        'test.js': `
console.log('one');
console.log('two');
`,
      });
    });

    testName = 'copy over comments in a page with scripts';
    test(testName, async () => {
      setSources({
        'test.html': `
          <!-- First comment -->
          <script>
            // comment in first script
            console.log('first script');
          </script>
          <!-- Second comment -->
          <script>
            // comment in second script
            console.log('second script');
          </script>
          <!-- Another comment -->
          <!-- Final trailing comment -->
        `
      });

      assertSources(await convert(), {
        'test.js': `
/* First comment */
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
// comment in first script
console.log('first script');
/* Second comment */
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
// comment in second script
console.log('second script');

/* Another comment */
/* Final trailing comment */
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
;
`,
      });
    });

    testName = 'copy over comments in a page without scripts';
    test(testName, async () => {
      setSources({
        'test.html': `
          <!-- First comment -->
          <!-- Second comment -->
          <!-- Final trailing comment -->
        `
      });

      assertSources(await convert(), {
        'test.js': `
/* First comment */
/* Second comment */
/* Final trailing comment */
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
;
`,
      });
    });


    testName = 'copy and escape comments that include JS comment tags';
    test(testName, async () => {
      setSources({
        'test.html': `
<!-- /* First comment */ -->
<!-- /* 1/2 comments */ /* 2/2 comments */ -->
<script>
  // comment in script
  console.log('second script');
</script>

<!--
  /**
   *  Final comment
   **/
-->`
      });

      assertSources(await convert(), {
        'test.js': `
/* /* First comment *\\/ */
/* /* 1/2 comments *\\/ /* 2/2 comments *\\/ */
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
// comment in script
console.log('second script');

/*
  /**
   *  Final comment
   **\\/
*/
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
;
`,
      });
    });


    testName = 'copy over license comments properly';
    test(testName, async () => {
      setSources({
        'test.html': `
          <!-- @license This is a license -->
          <!-- Second comment -->
          <!-- Final trailing comment -->
        `
      });

      assertSources(await convert(), {
        'test.js': `
/** @license This is a license */
/* Second comment */
/* Final trailing comment */
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
;
`,
      });
    });

    testName = 'copy over behavior comments properly';
    test(testName, async () => {
      setSources({
        'test.html': `
          <script>
            /**
             * This is a long and important comment.
             * It has much info.
             * @memberof Polymer This line should be removed
             * @polymerBehavior
             */
            Polymer.MyBehavior = {};

            /**
             * This comment is also important!
             *
             * @polymer
             * @mixinFunction
             */
            Polymer.MyMixinFunction = function() {};
          </script>
        `
      });

      assertSources(await convert(), {
        'test.js': `
/**
 * This is a long and important comment.
 * It has much info.
 * @polymerBehavior
 */
export const MyBehavior = {};

/**
 * This comment is also important!
 *
 * @polymer
 * @mixinFunction
 */
export const MyMixinFunction = function() {};
`,
      });
    });

    testName = 'copy over namespace method comments';
    test(testName, async () => {
      setSources({
        'test.html': `
          <script>
            /**
             * This is a comment on the namespace itself.
             *
             * @namespace
             * @memberof Polymer
             * @summary This is a summary on the namespace.
             */
            Polymer.Foo = {
              /**
               * This is a method on Foo.
               *
               * @function
               * @memberof Foo
               * @return {string}
               */
              methodOnFoo() {
                return 'foo result';
              }
            };
          </script>
        `
      });

      assertSources(await convert(), {
        'test.js': `
/**
 * This is a comment on the namespace itself.
 *
 * @summary This is a summary on the namespace.
 */
\`TODO(modulizer): A namespace named Polymer.Foo was
declared here. The surrounding comments should be reviewed,
and this string can then be deleted\`;

/**
 * This is a method on Foo.
 *
 * @function
 * @return {string}
 */
export function methodOnFoo() {
  return 'foo result';
}
`,
      });
    });

    testName = 'regression test: do not delete header comments';
    test(testName, async () => {
      setSources({
        'test.html': `<!--
@license
Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
-->
<script>
(function() {
  'use strict';

  // unresolved

  function resolve() {
    document.body.removeAttribute('unresolved');
  }

  if (window.WebComponents) {
    window.addEventListener('WebComponentsReady', resolve);
  } else {
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
      resolve();
    } else {
      window.addEventListener('DOMContentLoaded', resolve);
    }
  }

})();
</script>`
      });

      assertSources(await convert(), {
        'test.js': `
/**
@license
Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
Code distributed by Google as part of the polymer project is also
subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
*/
// unresolved

function resolve() {
  document.body.removeAttribute('unresolved');
}

if (window.WebComponents) {
  window.addEventListener('WebComponentsReady', resolve);
} else {
  if (document.readyState === 'interactive' || document.readyState === 'complete') {
    resolve();
  } else {
    window.addEventListener('DOMContentLoaded', resolve);
  }
}
`,
      });
    });

    testName = `insert leading comments before imports`;
    test(testName, async () => {
      setSources({
        'test.html': `<!--
    leading comment!
    -->
    <link rel="import" href="./foo.html">
    <script>
    (function() {
      'use strict';

      console.log('main file contents');

    })();
    </script>
    <link rel="import" href="./bar.html">
`,
        'foo.html': ``,
        'bar.html': ``
      });

      assertSources(await convert(), {
        'test.js': `
/*
    leading comment!
    */
/*
  FIXME(polymer-modulizer): the above comments were extracted
  from HTML and may be out of place here. Review them and
  then delete this comment!
*/
import './foo.js';

import './bar.js';

console.log('main file contents');
`,
      });
    });

    testName = `don't migrate comments when going html -> html`;
    test(testName, async () => {
      setSources({
        'index.html': `<!--
          leading comment!
          -->
          <link rel="import" href="./foo.html">
          <script>
          (function() {
            'use strict';

            console.log('main file contents');

          })();
          </script>
          <link rel="import" href="./bar.html">
`,
        'foo.html': ``,
        'bar.html': ``
      });

      assertSources(await convert(), {
        'index.html': `
<!--
          leading comment!
          -->
          <script type="module" src="./foo.js"></script>
          <script type="module">
import './foo.js';
import './bar.js';

console.log('main file contents');
</script>
          <script type="module" src="./bar.js"></script>
`,
      });
    });

    testName = `no need for a FIXME if it's just a license comment`;
    test(testName, async () => {
      setSources({
        'test.html': `<!--
            @license
            imagine this is a license
          -->
          <link rel="import" href="./foo.html">
          <script>
          (function() {
            'use strict';

            console.log('main file contents');

          })();
          </script>
          <link rel="import" href="./bar.html">
        `,
        'foo.html': ``,
        'bar.html': ``
      });

      assertSources(await convert(), {
        'test.js': `
/**
            @license
            imagine this is a license
          */
import './foo.js';

import './bar.js';

console.log('main file contents');
`,
      });
    });

    suite('regression tests', () => {
      testName = `propagate templates for scripts consisting ` +
          `only of an element definition`;
      test(testName, async () => {
        setSources({
          'test.html': `
        <dom-module id='url-bar'>
          <template>
            <div>Implementation here</div>
          </template>
          <script>
            Polymer({
              is: 'url-bar',
            })
          </script>
        </dom-module>
        `
        });

        assertSources(await convert(), {
          'test.js': `
Polymer({
  _template: Polymer.html\`
            <div>Implementation here</div>
\`,

  is: 'url-bar'
})
`,
        });
      });
    });
  });

  suite('getMemberPath', () => {
    function getMemberExpression(source: string) {
      const program = esprima.parse(source);
      const statement = program.body[0] as estree.ExpressionStatement;
      const expression = statement.expression as estree.AssignmentExpression;
      return expression.left as estree.MemberExpression;
    }

    test('works for a single property access', () => {
      const memberExpression = getMemberExpression(`Foo.Bar = 'A';`);
      const memberPath = getMemberPath(memberExpression);
      assert.deepEqual(memberPath, ['Foo', 'Bar']);
    });

    test('works for chained property access', () => {
      const memberExpression = getMemberExpression(`Foo.Bar.Baz = 'A';`);
      const memberPath = getMemberPath(memberExpression);
      assert.deepEqual(memberPath, ['Foo', 'Bar', 'Baz']);
    });

    test('discards leading `window`', () => {
      const memberExpression = getMemberExpression(`window.Foo.Bar.Baz = 'A';`);
      const memberPath = getMemberPath(memberExpression);
      assert.deepEqual(memberPath, ['Foo', 'Bar', 'Baz']);
    });
  });
});
