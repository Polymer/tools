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
import * as fs from 'fs';
import * as path from 'path';

import {Visitor} from '../../javascript/estree-visitor';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ScannedFeature} from '../../model/model';
import {ScannedPolymerElementMixin} from '../../polymer/polymer-element-mixin';
import {Polymer2MixinScanner} from '../../polymer/polymer2-mixin-scanner';

// function compareNames(a: {name?: string}, b: {name?: string}): number {
//   const nameA = a && a.name;
//   const nameB = b && b.name;

//   if (nameA == null)
//     return (nameB == null) ? 0 : -1;
//   if (nameB == null)
//     return 1;
//   return nameA.localeCompare(nameB);
// };

suite('Polymer2MixinScanner', () => {

  async function getMixins(filename: string):
      Promise<ScannedPolymerElementMixin[]> {
        const testFilesDir = path.resolve(__dirname, '../static/polymer2/');
        const testpath = path.resolve(testFilesDir, filename);
        const file = fs.readFileSync(testpath, 'utf8');
        const parser = new JavaScriptParser();
        const document = parser.parse(file, '/static/polymer2/test-mixin.js');
        const scanner = new Polymer2MixinScanner();
        const visit = (visitor: Visitor) =>
            Promise.resolve(document.visit([visitor]));

        const features: ScannedFeature[] = await scanner.scan(document, visit);
        return <ScannedPolymerElementMixin[]>features.filter(
            (e) => e instanceof ScannedPolymerElementMixin);
      };

  function getTestProps(mixin: ScannedPolymerElementMixin): any {
    return {
      name: mixin.name,
      properties: mixin.properties.map((p) => ({
                                         name: p.name,
                                       })),
      attributes: mixin.attributes.map((a) => ({
                                         name: a.name,
                                       })),
    };
  }

  test('finds mixin function declarations', async() => {
    const mixins = await getMixins('test-mixin-1.js');
    const mixinData = mixins.map(getTestProps);
    assert.deepEqual(mixinData, [{
                       name: 'TestMixin',
                       properties: [{
                         name: 'foo',
                       }],
                       attributes: [{
                         name: 'foo',
                       }],
                     }]);
  });

  test('finds mixin arrow function expressions', async() => {
    const mixins = await getMixins('test-mixin-2.js');
    const mixinData = mixins.map(getTestProps);
    assert.deepEqual(mixinData, [{
                       name: 'TestMixin',
                       properties: [{
                         name: 'foo',
                       }],
                       attributes: [{
                         name: 'foo',
                       }],
                     }]);
  });

  test('finds mixin function expressions', async() => {
    const mixins = await getMixins('test-mixin-3.js');
    const mixinData = mixins.map(getTestProps);
    assert.deepEqual(mixinData, [{
                       name: 'TestMixin',
                       properties: [{
                         name: 'foo',
                       }],
                       attributes: [{
                         name: 'foo',
                       }],
                     }]);
  });

  test(
      'finds mixin variable declaration with only name, does not use trailing function',
      async() => {
        const mixins = await getMixins('test-mixin-4.js');
        const mixinData = mixins.map(getTestProps);
        assert.deepEqual(mixinData, [{
                           name: 'TestMixin',
                           properties: [],
                           attributes: [],
                         }]);
      });

  test('what to do on a class marked @polymerMixin?', async() => {
    const mixins = await getMixins('test-mixin-5.js');
    const mixinData = mixins.map(getTestProps);
    assert.deepEqual(mixinData, []);
  });

  test('finds mixin function declaration with only name', async() => {
    const mixins = await getMixins('test-mixin-6.js');
    const mixinData = mixins.map(getTestProps);
    assert.deepEqual(mixinData, [{
                       name: 'TestMixin',
                       properties: [],
                       attributes: [],
                     }]);
  });

});
