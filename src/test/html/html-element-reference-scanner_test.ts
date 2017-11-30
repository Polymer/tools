/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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
import {HtmlCustomElementReferenceScanner, HtmlElementReferenceScanner} from '../../html/html-element-reference-scanner';
import {HtmlParser} from '../../html/html-parser';
import {ResolvedUrl} from '../../model/url';
import {CodeUnderliner} from '../test-utils';

suite('HtmlElementReferenceScanner', () => {
  suite('scan()', () => {
    let scanner: HtmlElementReferenceScanner;

    setup(() => {
      scanner = new HtmlElementReferenceScanner();
    });

    test('finds element references', async () => {
      const contents = `<html><head></head>
      <body>
        <div>Foo</div>
        <x-foo></x-foo>
        <div>
          <x-bar></x-bar>
        </div>
      </body></html>`;

      const document =
          new HtmlParser().parse(contents, 'test-document.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);

      const {features} = await scanner.scan(document, visit);

      assert.deepEqual(
          features.map((f) => f.tagName),
          ['html', 'head', 'body', 'div', 'x-foo', 'div', 'x-bar']);
    });
  });
});

suite('HtmlCustomElementReferenceScanner', () => {
  suite('scan()', () => {
    let scanner: HtmlCustomElementReferenceScanner;
    let contents = '';
    const loader = {canLoad: () => true, load: () => Promise.resolve(contents)};
    const underliner = new CodeUnderliner(loader);

    setup(() => {
      scanner = new HtmlCustomElementReferenceScanner();
    });

    test('finds custom element references', async () => {
      contents = `<html><body>
          <div>Foo</div>
          <x-foo a=5 b="test" c></x-foo>
          <div>
            <x-bar></x-bar>
          </div>
          <h1>Bar</h1>
          <template>
            <x-baz></x-baz>
          </template>
        </body></html>`;

      const document =
          new HtmlParser().parse(contents, 'test-document.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);

      const {features} = await scanner.scan(document, visit);

      assert.deepEqual(
          features.map((f) => f.tagName), ['x-foo', 'x-bar', 'x-baz']);

      assert.deepEqual(
          Array.from(features[0].attributes.values())
              .map((a) => [a.name, a.value]),
          [['a', '5'], ['b', 'test'], ['c', '']]);

      const sourceRanges = await Promise.all(
          features.map(async (f) => await underliner.underline(f.sourceRange)));

      assert.deepEqual(sourceRanges, [
        `
          <x-foo a=5 b="test" c></x-foo>
          ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
        `
            <x-bar></x-bar>
            ~~~~~~~~~~~~~~~`,
        `
            <x-baz></x-baz>
            ~~~~~~~~~~~~~~~`
      ]);

      const attrRanges = await Promise.all(features.map(
          async (f) =>
              await Promise.all(Array.from(f.attributes.values())
                                    .map(
                                        async (a) => await underliner.underline(
                                            a.sourceRange)))));

      assert.deepEqual(attrRanges, [
        [
          `
          <x-foo a=5 b="test" c></x-foo>
                 ~~~`,
          `
          <x-foo a=5 b="test" c></x-foo>
                     ~~~~~~~~`,
          `
          <x-foo a=5 b="test" c></x-foo>
                              ~`
        ],
        [],
        []
      ]);

      const attrNameRanges = await Promise.all(features.map(
          async (f) =>
              await underliner.underline(Array.from(f.attributes.values())
                                             .map((a) => a.nameSourceRange))));

      assert.deepEqual(attrNameRanges, [
        [
          `
          <x-foo a=5 b="test" c></x-foo>
                 ~`,
          `
          <x-foo a=5 b="test" c></x-foo>
                     ~`,
          `
          <x-foo a=5 b="test" c></x-foo>
                              ~`
        ],
        [],
        []
      ]);

      const attrValueRanges = await Promise.all(features.map(
          async (f) =>
              await Promise.all(Array.from(f.attributes.values())
                                    .map(
                                        async (a) => await underliner.underline(
                                            a.valueSourceRange)))));

      assert.deepEqual(attrValueRanges, [
        [
          `
          <x-foo a=5 b="test" c></x-foo>
                   ~`,
          `
          <x-foo a=5 b="test" c></x-foo>
                       ~~~~~~`,
          `No source range given.`
        ],
        [],
        []
      ]);
    });
  });
});
