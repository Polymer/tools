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
import {Analyzer, FSUrlLoader, applyEdits, makeParseLoader} from 'polymer-analyzer';

import {Linter} from '../../linter';
import {registry} from '../../registry';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

const ruleId = 'paper-toolbar-v1-to-v2';

suite(ruleId, () => {
  let analyzer: Analyzer;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    linter = new Linter(registry.getRules([ruleId]), analyzer);
  });

  async function assertFileChanges(inputFile: string, outputFile: string) {
    const warnings = await linter.lint([inputFile]);
    const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
    const loader = makeParseLoader(analyzer);
    const result = await applyEdits(edits, loader);
    const inputFileContent = result.editedFiles.get(inputFile)
    const outputFileContent = (await loader(outputFile)).contents;
    assert.deepEqual(inputFileContent, outputFileContent);
  }

  test('adds `slot="top"` to child elements without slots or special classes',
      async() => {
        await assertFileChanges(
          `${ruleId}/child-default-slot_before.html`,
          `${ruleId}/child-default-slot_after.html`);
      });

  test('adds `slot="middle"` to child elements with `class="middle"`',
      async() => {
        await assertFileChanges(
          `${ruleId}/child-middle-slot_before.html`,
          `${ruleId}/child-middle-slot_after.html`);
      });

  test('adds `slot="bottom"` to child elements with `class="bottom"`',
      async() => {
        await assertFileChanges(
          `${ruleId}/child-bottom-slot_before.html`,
          `${ruleId}/child-bottom-slot_after.html`);
      });

  test('wraps non-whitespace child text nodes with `<span slot="top">`...' +
      '`</span>`', async() => {
        await assertFileChanges(
          `${ruleId}/child-non-whitespace-text_before.html`,
          `${ruleId}/child-non-whitespace-text_after.html`);
      });

  test('many children requiring different fixes are all fixed', async() => {
      await assertFileChanges(
        `${ruleId}/children-mixed_before.html`,
        `${ruleId}/children-mixed_after.html`);
    });
});
