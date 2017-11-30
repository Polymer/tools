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
import {HtmlParser} from '../../html/html-parser';
import {ResolvedUrl} from '../../model/url';
import {DomModuleScanner} from '../../polymer/dom-module-scanner';
import {CodeUnderliner} from '../test-utils';

suite('DomModuleScanner', () => {
  suite('scan()', () => {
    let scanner: DomModuleScanner;

    setup(() => {
      scanner = new DomModuleScanner();
    });

    test('finds local IDs', async () => {
      const contents = `<html><head></head>
        <body>
          <dom-module>
            <template>
              <div id="foo"></div>
              <span id="bar"></div>
              <div id2="nope"></div>
              <template>
                <div id="nada"></div>
              </template>
            </template>
          </dom-module>
        </body>
        </html>`;
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);

      const {features: domModules} = await scanner.scan(document, visit);
      assert.equal(domModules.length, 1);
      assert.deepEqual(
          domModules[0].localIds.map((lid) => lid.name), ['foo', 'bar']);
    });

    test('finds databinding expressions IDs', async () => {
      const contents = `<html><head></head>
        <body>
          <dom-module>
            <template>
              <div id="{{foo}}"></div>
              <span id="{{bar(baz, boop)}}"></div>
              <other-elem prop="{{foo bar}}"></other-elem>
            </template>
          </dom-module>
        </body>
        </html>`;
      const document =
          new HtmlParser().parse(contents, 'test.html' as ResolvedUrl);
      const visit = async (visitor: HtmlVisitor) => document.visit([visitor]);
      const underliner = CodeUnderliner.withMapping('test.html', contents);

      const {features: domModules} = await scanner.scan(document, visit);
      assert.equal(domModules.length, 1);
      assert.deepEqual(
          await underliner.underline(
              domModules[0].databindings.map((db) => db.sourceRange)),
          [
            `
              <div id="{{foo}}"></div>
                         ~~~`,
            `
              <span id="{{bar(baz, boop)}}"></div>
                          ~~~~~~~~~~~~~~`
          ]);
      assert.deepEqual(await underliner.underline(domModules[0].warnings), [`
              <other-elem prop="{{foo bar}}"></other-elem>
                                      ~`]);
    });
  });
});
