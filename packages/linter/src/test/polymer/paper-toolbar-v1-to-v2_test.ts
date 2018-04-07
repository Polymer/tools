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

import * as path from 'path';
import {Analyzer} from 'polymer-analyzer';
import {ProjectConfig} from 'polymer-project-config';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {assertExpectedFixes} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

const ruleId = 'paper-toolbar-v1-to-v2';

suite(ruleId, () => {
  let analyzer: Analyzer;
  let linter: Linter;

  setup(async() => {
    ({analyzer} =
         await ProjectConfig.initializeAnalyzerFromDirectory(fixtures_dir));
    linter = new Linter(registry.getRules([ruleId]), analyzer);
  });

  let testName =
      'adds `slot="top"` to child elements without slots or special classes';
  test(testName, async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/child-default-slot_before.html`,
        `${ruleId}/child-default-slot_after.html`);
  });

  testName = 'adds `slot="middle"` to child elements with `class="middle"`';
  test(testName, async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/child-middle-slot_before.html`,
        `${ruleId}/child-middle-slot_after.html`);
  });

  testName = 'adds `slot="bottom"` to child elements with `class="bottom"`';
  test(testName, async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/child-bottom-slot_before.html`,
        `${ruleId}/child-bottom-slot_after.html`);
  });

  testName =
      'wraps non-whitespace child text nodes with `<span slot="top">`...' +
      '`</span>`';
  test(testName, async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/child-non-whitespace-text_before.html`,
        `${ruleId}/child-non-whitespace-text_after.html`);
  });

  test('many children requiring different fixes are all fixed', async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/children-mixed_before.html`,
        `${ruleId}/children-mixed_after.html`);
  });
});
