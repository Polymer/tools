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
import {Analyzer} from 'polymer-analyzer';
import {ProjectConfig} from 'polymer-project-config';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {assertExpectedFixes, WarningPrettyPrinter} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

const ruleId = 'iron-flex-layout-classes';

suite(ruleId, () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(async() => {
    ({analyzer} =
         await ProjectConfig.initializeAnalyzerFromDirectory(fixtures_dir));
    warningPrinter = new WarningPrettyPrinter();
    linter = new Linter(registry.getRules([ruleId]), analyzer);
  });

  test('works in the trivial case', async() => {
    const {warnings} = await linter.lint([]);
    assert.deepEqual([...warnings], []);
  });

  test('warns for the proper cases and with the right messages', async() => {
    const {warnings} = await linter.lint([`${ruleId}/before-fixes.html`]);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
      <div class="layout horizontal">
                 ~~~~~~~~~~~~~~~~~~~`,
      `
      <div class="layout horizontal">
                 ~~~~~~~~~~~~~~~~~~~`,
      `
        <p class="flex">lorem</p>
                 ~~~~~~`,
      `
      <div class="flex">
                 ~~~~~~`,
      `
        <p class="flex-1">lorem</p>
                 ~~~~~~~~`,
      `
      <div class="layout horizontal-reverse">
                 ~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
        <p class="flex-1">ipsum</p>
                 ~~~~~~~~`,
      `
    <style>
    ~~~~~~~`,
      `
          <div class="layout horizontal">
                     ~~~~~~~~~~~~~~~~~~~`,
      `
      <div class$="layout horizontal [[flex]]">
                  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
        <p class="flex" class$="flex [[flex]]">lorem</p>
                               ~~~~~~~~~~~~~~~`,
      `
<body class="fullbleed">
            ~~~~~~~~~~~`,
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      `"iron-flex" style module is used but not imported.
Import it in the template style include.`,
      `"iron-flex" style module is used but not imported.
Import it in the template style include.`,
      `"iron-flex" style module is used but not imported.
Import it in the template style include.`,
      `"iron-flex" style module is used but not imported.
Import it in the template style include.`,
      `"iron-flex-factors" style module is used but not imported.
Import it in the template style include.`,
      `"iron-flex-reverse" style module is used but not imported.
Import it in the template style include.`,
      `"iron-flex-factors" style module is used but not imported.
Import it in the template style include.`,
      'Style outside template. Run `move-style-into-template` rule.',
      `"iron-flex" style module is used but not imported.
Import it in the template style include.`,
      `"iron-flex" style module is used but not imported.
Import it in the template style include.`,
      `"iron-flex" style module is used but not imported.
Import it in the template style include.`,
      `"iron-positioning" style module is used but not imported.
Import it in the template style include.`,
    ]);
  });

  test('applies automatic-safe fixes', async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/before-fixes.html`,
        `${ruleId}/after-fixes.html`);
  });
});
