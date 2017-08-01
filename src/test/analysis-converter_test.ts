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
import * as path from 'path';
import {Analyzer, Document, FSUrlLoader, InMemoryOverlayUrlLoader, PackageUrlResolver, UrlLoader, UrlResolver} from 'polymer-analyzer';

import {AnalysisConverter, AnalysisConverterOptions} from '../analysis-converter';
import {configureAnalyzer, configureConverter} from '../convert-package';
import {getMemberPath} from '../util';


const fixturesDirPath = path.resolve(__dirname, '../../fixtures');

suite('AnalysisConverter', () => {

  suite('convertDocument', () => {

    let urlLoader: InMemoryOverlayUrlLoader;
    let analyzer: Analyzer;

    setup(() => {
      urlLoader = new InMemoryOverlayUrlLoader();
      analyzer = new Analyzer({urlLoader: urlLoader});
    });

    async function convert(partialOptions?: Partial<AnalysisConverterOptions>) {
      const options = {
        namespaces: ['Polymer'],
        mainFiles: ['test.html'],
        packageName: 'some-package',
        ...partialOptions,
      };
      const analysis =
          await analyzer.analyze([...urlLoader.urlContentsMap.keys()]);
      return new AnalysisConverter(analysis, options).convert();
    }

    function assertSources(
        results: Map<string, string>, expected: {[path: string]: string}) {
      for (const [expectedPath, expectedContents] of Object.entries(expected)) {
        const actualContents = results.get(expectedPath);
        if (actualContents === undefined) {
          assert.isTrue(
              'false',
              `No file named ${expectedPath} was generated. ` +
                  `Generated files: ${[...results.keys()].join(', ')}`);
          return;
        }
        assert.deepEqual(
            '\n' + actualContents,
            expectedContents,
            `Content of ${expectedPath} is wrong`);
      }
    }

    function setSources(sources: {[filename: string]: string}) {
      for (const [filename, source] of Object.entries(sources)) {
        urlLoader.urlContentsMap.set(filename, source);
      }
    }

    test('converts imports to .js', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./dep.html">
          <link rel="import" href="../dep.html">
          <script></script>
        `,
        'dep.html': `<h1>Hi</h1>`,
        'bower_components/dep.html': `<h1>Hi</h1>`,
      });
      assertSources(await convert(), {
        './test.js': `
import './dep.js';
import '../dep.js';
`
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
      assertSources(await convert(), {
        './test.js': `
import './nested/test.js';
import '../@polymer/app-storage/app-storage.js';
`,
        './nested/test.js': `
import '../../@polymer/app-route/app-route.js';
`,
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
              await convert({packageName: '@some-scope/some-package'}), {
                './test.js': `
import './nested/test.js';
import '../../@polymer/app-storage/app-storage.js';
`,
                './nested/test.js': `
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
      assertSources(await convert({packageType: 'application'}), {
        './test.js': `
import './nested/test.js';
import './node_modules/@polymer/app-storage/app-storage.js';
import '/node_modules/@polymer/app-route/app-route.js';
`,
        './nested/test.js': `
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
          assertSources(await convert({packageType: 'application'}), {
            './test.js': `
import './nested/test.js';
import './node_modules/@polymer/app-storage/app-storage.js';
import '/node_modules/@polymer/app-route/app-route.js';
`,
            './nested/test.js': `
import '../node_modules/@polymer/app-storage/app-storage.js';
import '/node_modules/@polymer/app-route/app-route.js';
`,
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
        './test.js': `
import './dep.js';
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
        './test.js': `
import { foo as $foo } from './foo.js';
import { bar as $bar } from './bar.js';
console.log($foo);
console.log($bar);
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
        './test.js': `
import { Polymer as $Polymer, foo as $foo } from \'./foo.js\';
console.log($Polymer());
console.log($Polymer());
console.log($foo);
console.log($Polymer[\'bar\']);
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
        './test.js': `
import { Polymer as $Polymer } from './foo.js';
var P = $Polymer;
var Po = $Polymer;
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
        './test.js': `
import './polymer.js';
import { Polymer as $Polymer } from './lib/legacy/polymer-fn.js';
console.log($Polymer());
console.log($Polymer());
`,

        './polymer.js': `
import './lib/legacy/polymer-fn.js';
`,

        './lib/legacy/polymer-fn.js': `
export const Polymer = function(info) {
  console.log("hey there, i\'m the polymer function!");
};
`
      });
    });


    test('unwraps top-level IIFE', async () => {
      setSources({
        'test.html': `
          <dom-module>
            <template>
              <h1>Test</h1>
            </template>
            <script>
              (function() {
                'use strict';

                Polymer.Foo = 'Bar';
              })();
            </script>
          </dom-module>
        `,
      });
      assertSources(await convert(), {
        './test.js': `
export const Foo = 'Bar';
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
        './test.js': `
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
        './test.js': `
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
        './test.js': `
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
        './test.js': `
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
        './test.js': `
export function fn() {
  foobar();
}

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
            './test.js': `
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
      assertSources(
          await convert(
              {mutableExports: {'Polymer.Namespace': ['mutableLiteral']}}),
          {
            './test.js': `
export const immutableLiteral = 42;
export let mutableLiteral = 0;

export function increment() {
  mutableLiteral++;
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
        './test.js': `
export const dom = function() {
  return 'Polymer.dom result';
};

export const subFn = function() {
  return 'Polymer.dom.subFn result';
};
`
      });
    });

    test(
        'exports a namespace function and fixes references to its properties',
        async () => {
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
            './test.js': `
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
        './test.js': `
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
        './test.js': `
import { Element as $Element } from './dep.js';
class MyElement extends $Element {}
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
        './test.js': `
import { Element as $Element } from './dep.js';
class MyElement extends $Element {}
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
        './test.js': `
import * as $$dep from './dep.js';
const Foo = $$dep;
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
        './test.js': `
import * as $$dep from './dep.js';
import { Element as $Element } from './dep.js';
const Foo = $$dep;
const Bar = Foo.Element;
const Baz = $Element;
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
        './test.js': `
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
            './test.js': `
import { Element as $Element } from './dep.js';
class MyElement extends $Element {}
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
            './test.js': `
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
            './test.js': `
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
            './test.js': `
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
        'test.html': `
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
        './test.js': `
/**
 * @customElement
 * @polymer
 */
class TestElement extends Polymer.Element {
  static get template() {
    return \`
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
        'test.html': `
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
        './test.js': `
Polymer({
  _template: \`
      <h1>Hi!</h1>
\`,

  is: 'test-element'
});
`
      });
    });

    test('converts arbitrary elements', async () => {
      setSources({
        'test.html': `
<custom-style><style>foo{}</style></custom-style>
`,
      });
      assertSources(await convert(), {
        './test.js': `
const $_documentContainer = document.createElement('div');
$_documentContainer.setAttribute('style', 'display: none;');
$_documentContainer.innerHTML = \`<custom-style><style>foo{}</style></custom-style>\`;
document.head.appendChild($_documentContainer);
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
        './test.js': `
import { qux as $qux } from './qux.js';
export const bar = 10;
export { $qux as zug };
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
            './test.js': `
import { Element as $Element } from './polymer.js';
class Element extends $Element {}
`,

            './polymer.js': `
/** @namespace */
const Polymer = {};
export const Element = class Element {};
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
            './test.js': `
import { Element as $Element } from './ns.js';
class Element extends $Element {}
`,

            './ns.js': `
/** @namespace */
const NS = {};
export const Element = class Element {};
`
          });
    });

    test('converts unimported html to use script type=module', async () => {
      setSources({
        'test.html': `
                <script>
                  Polymer.Element = class Element {};
                </script>`,
        'index.html': `
                <link rel="import" href="./test.html">

                <div>Hello world!</div>`
      });
      assertSources(await convert(), {
        './test.js': `
export const Element = class Element {};
`,

        './index.html': `

                <script type="module" src="./test.js"></script>

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
        './test.js': `
import { Element as $Element } from './polymer.js';
class FooElem extends $Element {}
class BarElem extends $Element {}
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
        './test.js': `
import { Element as $Element } from './polymer.js';
const $_documentContainer = document.createElement('div');
$_documentContainer.setAttribute('style', 'display: none;');
$_documentContainer.innerHTML = \`<div>Top</div><div>Middle</div><div>Bottom</div>\`;
document.head.appendChild($_documentContainer);
class FooElem extends $Element {}
class BarElem extends $Element {}
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
        './test.js': `
import { Element as $Element } from './polymer.js';
const $_documentContainer = document.createElement('div');
$_documentContainer.setAttribute('style', 'display: none;');
$_documentContainer.innerHTML = \`<div>Random footer</div>\`;
document.head.appendChild($_documentContainer);
customElements.define('foo-elem', class FooElem extends $Element {
  static get template() {
    return \`
    <div>foo-element body</div>
\`;
  }
});
customElements.define('bar-elem', class BarElem extends $Element {
  static get template() {
    return \`
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
      assertSources(await convert({mainFiles: ['subdir/element.html']}), {
        './subdir/element.js': `
import '../lib.js';
`,

        './subdir/index.html': `

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
        './polymer.js': `
export const Element = class Element {};
`,

        './index.html': `

          <div>This is some html.</div>
          <script type="module" src="./polymer.js"></script>
          <script type="module">
import { Element as $Element } from './polymer.js';
document.registerElement(
  'foo-elem', class FooElem extends $Element {});
</script>
          <script type="module">
            // this should not be changed because it is a module already
            document.registerElement(
              'bar-elem', class BarElem extends HTMLElement {});
          </script>
          <script type="module">
import { Element as $Element } from './polymer.js';
document.registerElement(
  'baz-elem', class BazElem extends $Element {});
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
        './index.html': `

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
        './test.js': `
console.log(window.document);
console.log(
  window.document.querySelectorAll(
    'div'));
console.log(foo.document.currentScript.ownerDocument);
`
      });
    });

    let testName = `handles imports that are modules but write to globals`;
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

      assertSources(await convert(), {
        './test.js': `
import '../@webcomponents/shadycss/entrypoints/custom-style-interface.js';
import '../@webcomponents/shadycss/entrypoints/apply-shim.js';
console.log(ShadyCSS.flush());
`,

        './index.html': `

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

      assertSources(await convert(), {
        './index.html': `

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
        './test.js': `
Polymer({
  _template: \`
foo
\`,

  is: 'foo'
});
Polymer({
  _template: \`
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
        './index.html': `

          <script type="module" src="./polymer.js"></script>
          <script type="module">
import './polymer.js';
export const foo = class Foo {foo() {}};
new foo().foo();
</script>
        `,
        './polymer.js': `
/** @namespace */
const Polymer = {};
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
        './settings.js': `
export const foo = 'default';

export const setFoo = function(newFoo) {
  foo = newFoo;
};

export const baz = 100;

export function setBaz(newBaz) {
  baz = newBaz;
}
`,

        './test.js': `
import { setFoo as $setFoo, setBaz as $setBaz, foo as $foo } from './settings.js';
$setFoo('hello');
$setBaz($foo + 10 * (10 ** 10));
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

      assertSources(await convert({packageName: 'polymer'}), {
        './index.html': `

          <script src="../foo/foo.js"></script>
        `,
      });
      assertSources(await convert({packageName: '@polymer/polymer'}), {
        './index.html': `

          <script src="../../foo/foo.js"></script>
        `,
      });
    });
  });

  suite('fixtures', () => {

    let urlResolver: UrlResolver;
    let urlLoader: UrlLoader;
    let analyzer: Analyzer;

    setup(() => {
      urlLoader = new FSUrlLoader(path.resolve(__dirname, '../../fixtures'));
      urlResolver = new PackageUrlResolver();
      analyzer = new Analyzer({
        urlResolver,
        urlLoader,
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

  test('case-map', async () => {
    const options = {
      inDir: fixturesDirPath,
      packageName: 'case-map',
      packageVersion: '1.0.0',
      mainFiles: ['case-map/case-map.html']
    };
    const analyzer = configureAnalyzer(options);
    const analysis = await analyzer.analyze(['case-map/case-map.html']);
    const converter = configureConverter(analysis, options);
    const converted = await converter.convert();
    const caseMapSource = converted.get('./case-map/case-map.js');
    assert.include(caseMapSource!, 'export function dashToCamelCase');
    assert.include(caseMapSource!, 'export function camelToDashCase');
  });

  test('polymer-element', async () => {
    const options = {
      inDir: fixturesDirPath,
      packageName: 'polymer-element',
      packageVersion: '1.0.0'
    };
    const filename = 'polymer-element/polymer-element.html';
    const analyzer = configureAnalyzer(options);
    const analysis = await analyzer.analyze([filename]);
    const doc = analysis.getDocument(filename) as Document;
    const converter = configureConverter(analysis, options);
    converter.convertDocument(doc);
    assert(
        converter.namespacedExports.has('Polymer.Element'),
        'Can find Polymer.Element');
  });

});
