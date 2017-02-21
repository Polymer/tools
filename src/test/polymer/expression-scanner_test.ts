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

import {HtmlVisitor} from '../../html/html-document';
import {HtmlParser} from '../../html/html-parser';
import {ExpressionScanner} from '../../polymer/expression-scanner';
import {CodeUnderliner} from '../test-utils';

suite('DomModuleScanner', () => {

  suite('scan()', () => {
    let scanner: ExpressionScanner;

    setup(() => {
      scanner = new ExpressionScanner();
    });

    test('finds expressions', async() => {
      const contents = `
        <dom-module id="foo-elem">
          <template>
            <div id="{{foo}}"></div>
            <input value="{{val::changed}}">
            <template is="dom-if">
              <div id="[[bar]]"></div>
            </template>
          </template>
          <script>
            Polymer({
              is: 'foo-elem',
            });
          </script>
        </dom-module>

        <div id="{{nope}}"></div>

        <template is="dom-bind">
          <div id="{{baz}}"></div>
        </template>
      `;
      const underliner = CodeUnderliner.withMapping('test.html', contents);
      const document = new HtmlParser().parse(contents, 'test.html');
      const visit = async(visitor: HtmlVisitor) => document.visit([visitor]);

      const expressions = await scanner.scan(document, visit);
      assert.deepEqual(
          await underliner.underline(expressions.map((e) => e.sourceRange)), [
            `
            <div id="{{foo}}"></div>
                    ~~~~~~~~~`,
            `
            <input value="{{val::changed}}">
                         ~~~~~~~~~~~~~~~~~~`,
            `
              <div id="[[bar]]"></div>
                      ~~~~~~~~~`,
            `
          <div id="{{baz}}"></div>
                  ~~~~~~~~~`
          ]);
      assert.deepEqual(
          expressions.map((e) => e.direction), ['{', '{', '[', '{']);
      assert.deepEqual(
          expressions.map((e) => e.expressionText),
          ['foo', 'val', 'bar', 'baz']);
      assert.deepEqual(
          expressions.map((e) => e.eventName),
          [undefined, 'changed', undefined, undefined]);
      assert.deepEqual(
          expressions.map((e) => e.attribute.name),
          ['id', 'value', 'id', 'id']);
    });

  });

});
