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

import {createForDirectory, fixtureDir} from '../test-utils';

suite('JavaScriptExportScanner', async () => {
  const {analyzer} = await createForDirectory(fixtureDir);

  async function getExports(filename: string) {
    const analysis = await analyzer.analyze([filename]);
    const result = analysis.getDocument(filename);
    if (!result.successful) {
      throw new Error('could not get document');
    }
    assert.deepEqual(result.value.getWarnings().map((w) => w.toString()), []);
    return result.value.getFeatures({kind: 'export'});
  }

  test('identifies the names that of exports', async () => {
    const features = await getExports('javascript/all-export-types.js');
    assert.deepEqual([...features].map((f) => [...f.identifiers]), [
      ['namedConstIdentifier'],
      ['default'],
      ['ClassName'],
      ['functionName'],
      ['identifierAssignedFunction'],
      ['a', 'b', 'c', 'd'],
      ['g', 'i', 'k'],
      ['anotherValue'],
      ['someValue']
    ]);
  });

  test('re-exports across multiple files correctly', async () => {
    const features = await getExports('javascript/re-export-all.js');
    // Like the list above, but flattened as they're all exported from one
    // export statement.
    assert.deepEqual([...features].map((f) => [...f.identifiers]), [[
                       'namedConstIdentifier',
                       'ClassName',
                       'functionName',
                       'identifierAssignedFunction',
                       'a',
                       'b',
                       'c',
                       'd',
                       'g',
                       'i',
                       'k',
                       'anotherValue',
                       'someValue'
                     ]]);
  });
});
