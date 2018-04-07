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
import {Analyzer, applyEdits, makeParseLoader} from 'polymer-analyzer';
import {ProjectConfig} from 'polymer-project-config';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {assertExpectedFixes, assertFileEdited} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

const ruleId = 'content-to-slot-declarations';

suite(ruleId, () => {
  let analyzer: Analyzer;
  let linter: Linter;

  setup(async() => {
    ({analyzer} =
         await ProjectConfig.initializeAnalyzerFromDirectory(fixtures_dir));
    linter = new Linter(registry.getRules([ruleId]), analyzer);
  });

  test('works in the trivial case', async() => {
    const {warnings} = await linter.lint([]);
    assert.deepEqual([...warnings], []);
  });

  test('applies automatic-safe fixes', async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/before-fixes.html`,
        `${ruleId}/after-fixes.html`);
  });

  test('applies fixes and edit actions', async() => {
    const {warnings, analysis} =
        await linter.lint([`${ruleId}/before-fixes.html`]);
    const edits = [];
    for (const warning of warnings) {
      if (warning.fix) {
        edits.push(warning.fix);
      }
      for (const action of warning.actions || []) {
        if (action.kind === 'edit') {
          edits.push(action.edit);
        }
      }
    }
    const loader = makeParseLoader(analyzer, analysis);
    const result = await applyEdits(edits, loader);
    await assertFileEdited(
        analyzer,
        result,
        `${ruleId}/before-fixes.html`,
        `${ruleId}/after-edits.html`);
  });
});
