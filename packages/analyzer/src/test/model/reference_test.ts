/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

import {Analyzer} from '../../core/analyzer';
import {Export} from '../../javascript/javascript-export-scanner';
import {ScannedReference} from '../../model/model';
import {createForDirectory, fixtureDir} from '../test-utils';

function getOnlyItem<T>(items: Iterable<T>): T {
  const arr = [...items];
  assert.equal(arr.length, 1);
  return arr[0];
}

suite('ScannedReference', () => {
  let analyzer: Analyzer;
  suiteSetup(async () => {
    analyzer = (await createForDirectory(fixtureDir)).analyzer;
  });

  test('resolves exports', async () => {
    const filename = 'javascript/exported-class.js';

    const analysis = await analyzer.analyze([filename]);
    const result = analysis.getDocument(filename);
    if (!result.successful) {
      throw new Error('could not get document');
    }
    const doc = result.value;
    assert.deepEqual(doc.getWarnings().map((w) => w.toString()), []);

    function resolve(feature: Export): string|undefined {
      const reference = new ScannedReference(
          'class',
          getOnlyItem(feature.identifiers),
          feature.sourceRange,
          feature.astNode,
          feature.astNodePath);
      const resolved = reference.resolve(doc);
      if (resolved.feature === undefined) {
        return undefined;
      }
      return getOnlyItem(resolved.feature.identifiers);
    }

    const exports = result.value.getFeatures({kind: 'export'});
    const actual =
        [...exports].map((e) => [getOnlyItem(e.identifiers), resolve(e)]);
    assert.deepEqual(actual, [
      ['Foo', 'Foo'],
      ['FooAlias', 'Foo'],
      ['Bar', 'Bar'],
    ]);
  });
});
