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

const ruleId = 'iron-flex-layout-import';

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

  test('warns when deprecated files are used with the right messages', async() => {
    const {warnings} =
        await linter.lint([`${ruleId}/deprecated-files-before-fixes.html`]);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
<link rel="import" href="./iron-flex-layout/classes/iron-flex-layout.html">
                        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
<link rel="import" href="./iron-flex-layout/classes/iron-shadow-flex-layout.html">
                        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      `./iron-flex-layout/classes/iron-flex-layout.html import is deprecated in iron-flex-layout v1, and not shipped in iron-flex-layout v2.
Replace it with ./iron-flex-layout/iron-flex-layout-classes.html import.
Run the lint rule \`iron-flex-layout-classes\` with \`--fix\` to include the required style modules.`,
      `./iron-flex-layout/classes/iron-shadow-flex-layout.html import is deprecated in iron-flex-layout v1, and not shipped in iron-flex-layout v2.
Replace it with ./iron-flex-layout/iron-flex-layout-classes.html import.
Run the lint rule \`iron-flex-layout-classes\` with \`--fix\` to include the required style modules.`,
    ]);
  });

  let testName = 'applies automatic-safe fixes when deprecated files are used';
  test(testName, async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/deprecated-files-before-fixes.html`,
        `${ruleId}/deprecated-files-after-fixes.html`);
  });

  testName = 'warns when iron-flex-layout modules are used but not imported';
  test(testName, async() => {
    const {warnings} =
        await linter.lint([`${ruleId}/forgot-import-before-fixes.html`]);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
    <style include="iron-flex"></style>
                   ~~~~~~~~~~~`,
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      `iron-flex-layout style modules are used but not imported.
Import iron-flex-layout/iron-flex-layout-classes.html`,
    ]);
  });

  test('adds missing import by inferring the base path', async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/forgot-import-before-fixes.html`,
        `${ruleId}/forgot-import-after-fixes.html`);
  });

  test('adds missing import by defaulting the base path', async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/forgot-import-no-imports-before-fixes.html`,
        `${ruleId}/forgot-import-no-imports-after-fixes.html`);
  });

  test('warns when iron-flex-layout modules are imported but not used', async() => {
    const {warnings} =
        await linter.lint([`${ruleId}/unnecessary-import-before-fixes.html`]);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
<link rel="import" href="iron-flex-layout/iron-flex-layout-classes.html">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      `This import defines style modules that are not being used. It can be removed.`,
    ]);
  });

  test('removes unnecessary import', async() => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/unnecessary-import-before-fixes.html`,
        `${ruleId}/unnecessary-import-after-fixes.html`);
  });
});
