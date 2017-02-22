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

suite('ExpressionScanner', () => {

  suite('scan()', () => {
    let scanner: ExpressionScanner;

    setup(() => {
      scanner = new ExpressionScanner();
    });

    test('finds whole-attribute expressions', async() => {
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
          expressions.map((e) => e.attribute && e.attribute.name),
          ['id', 'value', 'id', 'id']);
      assert.deepEqual(
          expressions.map((e) => e.databindingInto),
          ['attribute', 'attribute', 'attribute', 'attribute']);
    });

    test('finds interpolated attribute expressions', async() => {
      const contents = `
        <template is="dom-bind">
          <div id=" {{foo}}"></div>
          <div id="bar {{val}} baz">
          <div id=" [[x]]{{y}}"></div>
        </template>
      `;
      const underliner = CodeUnderliner.withMapping('test.html', contents);
      const document = new HtmlParser().parse(contents, 'test.html');
      const visit = async(visitor: HtmlVisitor) => document.visit([visitor]);

      const expressions = await scanner.scan(document, visit);

      // TODO(rictic): improve these source ranges.
      assert.deepEqual(
          await underliner.underline(expressions.map((e) => e.sourceRange)), [
            `
          <div id=" {{foo}}"></div>
                  ~~~~~~~~~~`,
            `
          <div id="bar {{val}} baz">
                  ~~~~~~~~~~~~~~~~~`,
            `
          <div id=" [[x]]{{y}}"></div>
                  ~~~~~~~~~~~~~`,
            `
          <div id=" [[x]]{{y}}"></div>
                  ~~~~~~~~~~~~~`
          ]);
      assert.deepEqual(
          expressions.map((e) => e.direction), ['{', '{', '[', '{']);
      assert.deepEqual(
          expressions.map((e) => e.expressionText), ['foo', 'val', 'x', 'y']);
      assert.deepEqual(
          expressions.map((e) => e.eventName),
          [undefined, undefined, undefined, undefined]);
      assert.deepEqual(
          expressions.map((e) => e.attribute && e.attribute.name),
          ['id', 'id', 'id', 'id']);
      assert.deepEqual(expressions.map((e) => e.databindingInto), [
        'string-interpolation',
        'string-interpolation',
        'string-interpolation',
        'string-interpolation'
      ]);
    });

    test('finds expressions in text nodes', async() => {
      const contents = `
        <template is="dom-bind">
          <div>{{foo}}</div>
          <div>
            {{bar}} + {{baz}}[[zod]]
          </div>
        </template>
      `;

      const underliner = CodeUnderliner.withMapping('test.html', contents);
      const document = new HtmlParser().parse(contents, 'test.html');
      const visit = async(visitor: HtmlVisitor) => document.visit([visitor]);

      const expressions = await scanner.scan(document, visit);

      // TODO(rictic): improve these source ranges.
      assert.deepEqual(
          await underliner.underline(expressions.map((e) => e.sourceRange)), [
            `
          <div>{{foo}}</div>
               ~~~~~~~`,
            `
          <div>
               ~
            {{bar}} + {{baz}}[[zod]]
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
          </div>
~~~~~~~~~~`,
            `
          <div>
               ~
            {{bar}} + {{baz}}[[zod]]
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
          </div>
~~~~~~~~~~`,
            `
          <div>
               ~
            {{bar}} + {{baz}}[[zod]]
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
          </div>
~~~~~~~~~~`,
          ]);
      assert.deepEqual(
          expressions.map((e) => e.direction), ['{', '{', '{', '[']);
      assert.deepEqual(
          expressions.map((e) => e.expressionText),
          ['foo', 'bar', 'baz', 'zod']);
      assert.deepEqual(
          expressions.map((e) => e.eventName),
          [undefined, undefined, undefined, undefined]);
      assert.deepEqual(
          expressions.map((e) => e.attribute && e.attribute.name),
          [undefined, undefined, undefined, undefined]);
      assert.deepEqual(expressions.map((e) => e.databindingInto), [
        'string-interpolation',
        'string-interpolation',
        'string-interpolation',
        'string-interpolation'
      ]);
    });
  });

});
