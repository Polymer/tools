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

import * as babel from 'babel-types';
import {assert} from 'chai';

import {HtmlParser} from '../../html/html-parser';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ResolvedUrl} from '../../model/url';
import {AttributeDatabindingExpression, parseExpressionInJsStringLiteral, scanDocumentForExpressions, TextNodeDatabindingExpression} from '../../polymer/expression-scanner';
import {CodeUnderliner} from '../test-utils';

suite('ExpressionScanner', () => {
  suite('scanning html for expressions', () => {
    test('finds whole-attribute expressions', async () => {
      const contents = `
        <dom-module id="foo-elem">
          <template>
            <div id="{{foo}}"></div>
            <input value="{{val::changed}}">
            <template is="dom-if">
              <div id="[[bar]]"></div>
            </template>
            <div id="{{bada(wing, daba.boom, 10, -20)}}"></div>
          </template>
          <script>
            Polymer({
              is: 'foo-elem',
            });
          </script>
        </dom-module>

        <div id="{{nope}}"></div>
        <template>
          <div id="{{notHereEither}}"></div>
        </template>

        <template is="dom-bind">
          <div id="{{baz}}"></div>
        </template>
      `;
      const underliner = CodeUnderliner.withMapping('test.html', contents);
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);

      const results = await scanDocumentForExpressions(document);
      const generalExpressions = results.expressions;

      assert.deepEqual(results.warnings, []);
      assert.deepEqual(
          generalExpressions.map((e) => e.databindingInto),
          ['attribute', 'attribute', 'attribute', 'attribute', 'attribute']);
      const expressions =
          generalExpressions as AttributeDatabindingExpression[];
      assert.deepEqual(
          await underliner.underline(expressions.map((e) => e.sourceRange)), [
            `
            <div id="{{foo}}"></div>
                       ~~~`,
            `
            <input value="{{val::changed}}">
                            ~~~~~~~~~~~~`,
            `
            <div id="{{bada(wing, daba.boom, 10, -20)}}"></div>
                       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
            `
              <div id="[[bar]]"></div>
                         ~~~`,
            `
          <div id="{{baz}}"></div>
                     ~~~`,
          ]);
      assert.deepEqual(
          expressions.map((e) => e.direction), ['{', '{', '{', '[', '{']);
      assert.deepEqual(
          expressions.map((e) => e.expressionText),
          ['foo', 'val', 'bada(wing, daba.boom, 10, -20)', 'bar', 'baz']);
      assert.deepEqual(
          expressions.map((e) => e.eventName),
          [undefined, 'changed', undefined, undefined, undefined]);
      assert.deepEqual(
          expressions.map((e) => e.attribute && e.attribute.name),
          ['id', 'value', 'id', 'id', 'id']);
      assert.deepEqual(
          expressions.map((e) => e.properties.map((p) => p.name)),
          [['foo'], ['val'], ['bada', 'wing', 'daba'], ['bar'], ['baz']]);
      assert.deepEqual(
          expressions.map((e) => e.warnings), [[], [], [], [], []]);
      assert.deepEqual(
          expressions.map((e) => e.isCompleteBinding),
          [true, true, true, true, true]);
    });

    test('finds interpolated attribute expressions', async () => {
      const contents = `
        <template is="dom-bind">
          <div id=" {{foo}}"></div>
          <div id="bar {{val}} baz">
          <div id=" [[x]]{{y}}"></div>
        </template>

        <div id=" {{nope}}"></div>
        <template>
          <div id="{{notHereEither}}"></div>
        </template>

      `;
      const underliner = CodeUnderliner.withMapping('test.html', contents);
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);

      const results = await scanDocumentForExpressions(document);
      const generalExpressions = results.expressions;

      assert.deepEqual(results.warnings, []);
      assert.deepEqual(
          await underliner.underline(
              generalExpressions.map((e) => e.sourceRange)),
          [
            `
          <div id=" {{foo}}"></div>
                      ~~~`,
            `
          <div id="bar {{val}} baz">
                         ~~~`,
            `
          <div id=" [[x]]{{y}}"></div>
                      ~`,
            `
          <div id=" [[x]]{{y}}"></div>
                           ~`
          ]);
      const expressions =
          generalExpressions as AttributeDatabindingExpression[];
      assert.deepEqual(
          expressions.map((e) => e.isCompleteBinding),
          [false, false, false, false]);
      assert.deepEqual(
          expressions.map((e) => e.direction), ['{', '{', '[', '{']);
      assert.deepEqual(
          expressions.map((e) => e.expressionText), ['foo', 'val', 'x', 'y']);
      assert.deepEqual(
          expressions.map((e) => e.properties.map((p) => p.name)),
          [['foo'], ['val'], ['x'], ['y']]);
      assert.deepEqual(expressions.map((e) => e.warnings), [[], [], [], []]);
      assert.deepEqual(
          expressions.map((e) => e.eventName),
          [undefined, undefined, undefined, undefined]);
      assert.deepEqual(
          expressions.map((e) => e.attribute && e.attribute.name),
          ['id', 'id', 'id', 'id']);
      assert.deepEqual(
          expressions.map((e) => e.databindingInto),
          ['attribute', 'attribute', 'attribute', 'attribute']);
    });

    test('finds expressions in text nodes', async () => {
      const contents = `
        <template is="dom-bind">
          <div>{{foo}}</div>
          <div>
            {{bar}} + {{baz}}[[zod]]
            {{
              multiline(
                expressions
              )
            }}
          </div>
        </template>

        {{nope}}
        <template>
          <div id="{{notHereEither}}"></div>
        </template>
      `;

      const underliner = CodeUnderliner.withMapping('test.html', contents);
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);

      const results = await scanDocumentForExpressions(document);
      const generalExpressions = results.expressions;

      assert.deepEqual(results.warnings, []);
      assert.deepEqual(
          generalExpressions.map((e) => e.databindingInto),
          ['text-node', 'text-node', 'text-node', 'text-node', 'text-node']);
      const expressions = generalExpressions as TextNodeDatabindingExpression[];
      assert.deepEqual(
          await underliner.underline(expressions.map((e) => e.sourceRange)), [
            `
          <div>{{foo}}</div>
                 ~~~`,
            `
            {{bar}} + {{baz}}[[zod]]
              ~~~`,
            `
            {{bar}} + {{baz}}[[zod]]
                        ~~~`,
            `
            {{bar}} + {{baz}}[[zod]]
                               ~~~`,
            `
            {{
              ~
              multiline(
~~~~~~~~~~~~~~~~~~~~~~~~
                expressions
~~~~~~~~~~~~~~~~~~~~~~~~~~~
              )
~~~~~~~~~~~~~~~
            }}
~~~~~~~~~~~~`
          ]);
      assert.deepEqual(
          expressions.map((e) => e.direction), ['{', '{', '{', '[', '{']);
      assert.deepEqual(expressions.map((e) => e.expressionText), [
        'foo',
        'bar',
        'baz',
        'zod',
        `
              multiline(
                expressions
              )
            `
      ]);
      assert.deepEqual(
          expressions.map((e) => e.properties.map((p) => p.name)),
          [['foo'], ['bar'], ['baz'], ['zod'], ['multiline', 'expressions']]);
      assert.deepEqual(
          expressions.map((e) => e.warnings), [[], [], [], [], []]);
    });

    test('gives accurate locations for parse errors', async () => {
      const contents = `
        <template is="dom-bind">
          <div id="{{foo(}}"></div>
          <div id='[[
            foo bar
          ]]'></div>
          {{]}}

          <!-- ignores expressions that are invalid JS -->
          <div id="{{foo(bar.*)}}"></div>
          <div id="{{foo(bar.0)}}"></div>

          <!-- finds warnings in valid JS but invalid Polymer expressions -->
          <div id="{{-foo}}"></div>
          {{foo(!bar, () => baz)}}
        </template>
      `;

      const underliner = CodeUnderliner.withMapping('test.html', contents);
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);

      const results = await scanDocumentForExpressions(document);
      assert.deepEqual(
          await underliner.underline(
              results.warnings.map((w) => w.sourceRange)),
          [
            `
          <div id="{{foo(}}"></div>
                         ~`,
            `
            foo bar
                ~`,
            `
          {{]}}
            ~`,
            `
          <div id="{{-foo}}"></div>
                     ~~~~`,
            `
          {{foo(!bar, () => baz)}}
                ~~~~`,
            `
          {{foo(!bar, () => baz)}}
                      ~~~~~~~~~`
          ]);
    });
  });

  suite('parsing expressions from javascript string literals', () => {
    test('it succeeds and fails properly', async () => {
      const contents = `
        const observers = [
          'foo(bar, baz)',
          'foo(bar baz)',
          'foo(bar.*)',
          10,
          observerAssignedElsewhere,
        ];
      `;
      const underliner = CodeUnderliner.withMapping('test.js', contents);
      const javascriptDocument =
          new JavaScriptParser().parse(contents, 'test.js' as ResolvedUrl);
      const literals: babel.Literal[] =
          (javascriptDocument.ast as any)
              .body[0]['declarations'][0]['init']['elements'];

      const parsedLiterals = literals.map(
          (l) =>
              parseExpressionInJsStringLiteral(javascriptDocument, l, 'full'));
      const warnings = parsedLiterals.map((pl) => pl.warnings)
                           .reduce((p, n) => p.concat(n), []);
      const expressionRanges = parsedLiterals.map(
          (pl) => pl.databinding && pl.databinding.sourceRange);
      assert.deepEqual(await underliner.underline(expressionRanges), [
        `
          'foo(bar, baz)',
           ~~~~~~~~~~~~~`,
        `No source range given.`,
        `No source range given.`,
        `No source range given.`,
        `No source range given.`,
      ]);
      assert.deepEqual(await underliner.underline(warnings), [
        `
          'foo(bar baz)',
                   ~`,
        `
          10,
          ~~`,
        `
          observerAssignedElsewhere,
          ~~~~~~~~~~~~~~~~~~~~~~~~~`,
      ]);
    });
  });
});
