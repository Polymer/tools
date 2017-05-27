import * as esprima from 'esprima';
import * as estree from 'estree';

import {Analyzer, InMemoryOverlayUrlLoader, Document} from 'polymer-analyzer';
import {html2Js, getMemberPath} from '../html2js';
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

    test('converts imports to .js', async () => {
      urlLoader.urlContentsMap.set('test.html', `
        <link rel="import" href="./dep.html">
        <script></script>
      `);
      urlLoader.urlContentsMap.set('dep.html', `
        <h1>Hi</h1>
      `);
      const analysis = await analyzer.analyze(['test.html']);
      const testDoc = analysis.getDocument('test.html') as Document;
      const jsSource = html2Js(testDoc);
      console.log(jsSource);
      assert.equal(jsSource, `import './dep.js';\n`);
    });

    test('unwraps top-level IIFE', async () => {
      urlLoader.urlContentsMap.set('test.html', `
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
        </dom-module>`);
      const analysis = await analyzer.analyze(['test.html']);
      const testDoc = analysis.getDocument('test.html') as Document;
      const jsSource = html2Js(testDoc);
      assert.equal(jsSource, `export let Foo = 'Bar';\n`);
    });

    test('exports a reference', async () => {
      urlLoader.urlContentsMap.set('test.html', `
          <script>
            (function() {
              'use strict';

              Polymer.ArraySelectorMixin = ArraySelectorMixin;
            })();
          </script>`);
      const analysis = await analyzer.analyze(['test.html']);
      const testDoc = analysis.getDocument('test.html') as Document;
      const jsSource = html2Js(testDoc);
      assert.equal(jsSource,
`export {
  ArraySelectorMixin
};
`);
    });

    test('exports a value to a nested namespace', async () => {
      urlLoader.urlContentsMap.set('test.html', `
          <script>
            (function() {
              window.Polymer.version = '2.0.0';
            })();
          </script>`);
      const analysis = await analyzer.analyze(['test.html']);
      const testDoc = analysis.getDocument('test.html') as Document;
      const jsSource = html2Js(testDoc);
      assert.equal(jsSource, `export let version = '2.0.0';\n`);
    });

    test('exports the result of a funciton call', async () => {
      urlLoader.urlContentsMap.set('test.html', `
          <script>
            Polymer.LegacyElementMixin = Polymer.dedupingMixin();
          </script>`);
      const analysis = await analyzer.analyze(['test.html']);
      const testDoc = analysis.getDocument('test.html') as Document;
      const jsSource = html2Js(testDoc);
      assert.equal(jsSource, `export let LegacyElementMixin = Polymer.dedupingMixin();\n`);
    });

    test('exports a namespace object\'s properties', async () => {
      urlLoader.urlContentsMap.set('test.html', `
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
          </script>`);
      const analysis = await analyzer.analyze(['test.html']);
      const testDoc = analysis.getDocument('test.html') as Document;
      const jsSource = html2Js(testDoc);
      assert.equal(jsSource, `export let obj = {};
export function meth() {
}
export function func() {
}
export let arrow = () => {
};
`);
    });

    test('exports a referenced namespace', async () => {
      urlLoader.urlContentsMap.set('test.html', `
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
          </script>`);
      const analysis = await analyzer.analyze(['test.html']);
      const testDoc = analysis.getDocument('test.html') as Document;
      const jsSource = html2Js(testDoc);
      assert.equal(jsSource, `export let obj = {};\n`);
    });

  });

  suite('getMemberPath', () => {

    test('works for a single property access', () => {
      const program = esprima.parse(`Foo.Bar = 'A';`);
      const statement = program.body[0] as estree.ExpressionStatement;
      const expression = statement.expression as estree.AssignmentExpression;
      const memberExpression = expression.left as estree.MemberExpression;

      const memberPath = getMemberPath(memberExpression);
      assert.deepEqual(memberPath, ['Foo', 'Bar']);
    });

    test('works for chained property access', () => {
      const program = esprima.parse(`Foo.Bar.Baz = 'A';`);
      const statement = program.body[0] as estree.ExpressionStatement;
      const expression = statement.expression as estree.AssignmentExpression;
      const memberExpression = expression.left as estree.MemberExpression;

      const memberPath = getMemberPath(memberExpression);
      assert.deepEqual(memberPath, ['Foo', 'Bar', 'Baz']);
    });

    test('discards leading `window`', () => {
      const program = esprima.parse(`window.Foo.Bar.Baz = 'A';`);
      const statement = program.body[0] as estree.ExpressionStatement;
      const expression = statement.expression as estree.AssignmentExpression;
      const memberExpression = expression.left as estree.MemberExpression;

      const memberPath = getMemberPath(memberExpression);
      assert.deepEqual(memberPath, ['Foo', 'Bar', 'Baz']);
    });


  });

});