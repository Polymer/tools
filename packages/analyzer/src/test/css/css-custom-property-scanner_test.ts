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

import {Analyzer} from '../../core/analyzer';
import {CodeUnderliner, createForDirectory, fixtureDir} from '../test-utils';

suite('CssCustomPropertyScanner', () => {
  let analyzer: Analyzer;
  let underliner: CodeUnderliner;
  before(async () => {
    ({analyzer, underliner} = await createForDirectory(fixtureDir));
  });

  test('finds custom property assignments', async () => {
    const result = await analyzer.analyze(['some-styles.html']);
    const assignments =
        [...result.getFeatures({kind: 'css-custom-property-assignment'})];
    assert.deepEqual(
        await Promise.all(
            assignments.map((a) => underliner.underline(a.sourceRange))),
        [
          `
      --primary-text-color: var(--light-theme-text-color);
      ~~~~~~~~~~~~~~~~~~~~`,
          `
      --primary-background-color: var(--light-theme-background-color, --orange);
      ~~~~~~~~~~~~~~~~~~~~~~~~~~`,
          `
      --light-theme-background-color: #ffffff;
      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`

        ]);
    assert.deepEqual(assignments.map((a) => a.name), [
      '--primary-text-color',
      '--primary-background-color',
      '--light-theme-background-color'
    ]);
  });

  test('finds custom property uses', async () => {
    const result = await analyzer.analyze(['some-styles.html']);
    const assignments =
        [...result.getFeatures({kind: 'css-custom-property-use'})];
    assert.deepEqual(
        await Promise.all(
            assignments.map((a) => underliner.underline(a.sourceRange))),
        [
          `
        @apply(--layout-inline);
               ~~~~~~~~~~~~~~~`,
          `
        @apply --layout-center-center;
               ~~~~~~~~~~~~~~~~~~~~~~`,
          `
      --primary-text-color: var(--light-theme-text-color);
                                ~~~~~~~~~~~~~~~~~~~~~~~~`,
          `
      --primary-background-color: var(--light-theme-background-color, --orange);
                                      ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
          `
      --primary-background-color: var(--light-theme-background-color, --orange);
                                                                      ~~~~~~~~`,
        ]);
    assert.deepEqual(assignments.map((a) => a.name), [
      '--layout-inline',
      '--layout-center-center',
      '--light-theme-text-color',
      '--light-theme-background-color',
      '--orange'
    ]);
  });
});
