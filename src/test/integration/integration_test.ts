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
import * as path from 'path';
import {Document} from 'polymer-analyzer';

import {configureAnalyzer, configureConverter} from '../../convert-package';


suite('integration tests', function() {

  this.timeout(10 * 1000);

  const fixturesDirPath = path.resolve(__dirname, '../../../fixtures');

  test('case-map', async () => {
    const options = {inDir: fixturesDirPath};
    const analyzer = configureAnalyzer(options);
    const analysis = await analyzer.analyze(['case-map/case-map.html']);
    const converter = configureConverter(analysis, options);
    const converted = await converter.convert();
    const caseMapSource = converted.get('./case-map/case-map.js');
    assert.include(caseMapSource!, 'export function dashToCamelCase');
    assert.include(caseMapSource!, 'export function camelToDashCase');
  });

  test('polymer-element', async () => {
    const options = {inDir: fixturesDirPath};
    const filename = 'polymer-element/polymer-element.html';
    const analyzer = configureAnalyzer(options);
    const analysis = await analyzer.analyze([filename]);
    const doc = analysis.getDocument(filename) as Document;
    const converter = configureConverter(analysis, {});
    converter.convertDocument(doc);
    assert(converter.namespacedExports.has('Polymer.Element'));
  });

});
