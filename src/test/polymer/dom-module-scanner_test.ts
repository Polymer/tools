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

import {DomModuleScanner, ScannedDomModule} from '../../polymer/dom-module-scanner';
import {CodeUnderliner, runScannerOnContents} from '../test-utils';

suite('DomModuleScanner', () => {
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

    const {features} = await runScannerOnContents(
        new DomModuleScanner(), 'test.html', contents);
    assert.deepEqual(
        features.map((f: ScannedDomModule) => f.localIds.map((l) => l.name)),
        [['foo', 'bar']]);
    assert.deepEqual(
        features.map(
            (f: ScannedDomModule) => f.localIds.map((l) => l.nodeName)),
        [['div', 'span']]);
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
    const {features, analyzer} = await runScannerOnContents(
        new DomModuleScanner(), 'test.html', contents);
    const underliner = new CodeUnderliner(analyzer);
    const domModules = features as ScannedDomModule[];
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
