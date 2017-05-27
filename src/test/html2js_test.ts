import * as esprima from 'esprima';
import * as estree from 'estree';

import {Analyzer, InMemoryOverlayUrlLoader, Document} from 'polymer-analyzer';
import {html2Js, getMemberPath, ModuleExport} from '../html2js';
import {assert} from 'chai';

suite('html2js', () => {

  suite('html2Js', () => {

    let urlLoader: InMemoryOverlayUrlLoader;
    let analyzer: Analyzer;

    setup(() => {
      urlLoader = new InMemoryOverlayUrlLoader();
      analyzer = new Analyzer({
        urlLoader: urlLoader
      })
    });

    async function getJs(exports?: Map<string, ModuleExport>) {
      const analysis = await analyzer.analyze(['test.html']);
      const testDoc = analysis.getDocument('test.html') as Document;
      return html2Js(testDoc, exports);
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
          <script></script>
        `,
        'dep.html': `<h1>Hi</h1>`,
      });
      assert.equal(await getJs(), `import './dep.js';\n`);
    });

    test('converts imports to .js without scripts', async () => {
      setSources({
        'test.html': `
          <link rel="import" href="./dep.html">
        `,
        'dep.html': `<h1>Hi</h1>`,
      });
      assert.equal(await getJs(), `import './dep.js';\n`);
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
      assert.equal(await getJs(), `export let Foo = 'Bar';\n`);
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
      assert.equal(await getJs(),
`export {
  ArraySelectorMixin
};
`);
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
      assert.equal(await getJs(), `export let version = '2.0.0';\n`);
    });

    test('exports the result of a funciton call', async () => {
      urlLoader.urlContentsMap.set('test.html', `
          <script>
            Polymer.LegacyElementMixin = Polymer.dedupingMixin();
          </script>`);
      assert.equal(await getJs(), `export let LegacyElementMixin = Polymer.dedupingMixin();\n`);
    });

    test('exports a namespace object\'s properties', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               */
              Polymer.Namespace = {
                obj: {},
                meth() {},
                func: function() {},
                arrow: () => {}
              };
            })();
          </script>`,
      });
      assert.equal(await getJs(), `export let obj = {};
export function meth() {
}
export function func() {
}
export let arrow = () => {
};
`);
    });

    test('exports a referenced namespace', async () => {
      setSources({
        'test.html': `
          <script>
            (function() {
              'use strict';
              /**
               * @namespace
               */
              Namespace = {
                obj: {},
              };
              Polymer.Namespace = Namespace;
            })();
          </script>`,
      });
      assert.equal(await getJs(), `export let obj = {};\n`);
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
      const js = await getJs(new Map(Object.entries({
        'Polymer.Element': {
          url: 'dep.html',
          name: 'Element',
        }
      })));
      // TODO: rewrite references
      assert.equal(js, `import { Element } from './dep.js';
class MyElement extends Element {
}\n`);
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