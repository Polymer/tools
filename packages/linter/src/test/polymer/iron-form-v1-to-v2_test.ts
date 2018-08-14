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
import * as path from 'path';
import {Analyzer} from 'polymer-analyzer';
import {ProjectConfig} from 'polymer-project-config';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {assertExpectedFixes, WarningPrettyPrinter} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

const ruleId = 'iron-form-v1-to-v2';

suite(ruleId, () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(async () => {
    ({analyzer} =
         await ProjectConfig.initializeAnalyzerFromDirectory(fixtures_dir));
    warningPrinter = new WarningPrettyPrinter();
    linter = new Linter(registry.getRules([ruleId]), analyzer);
  });

  test('works in the trivial case', async () => {
    const {warnings} = await linter.lint([]);
    assert.deepEqual([...warnings], []);
  });

  test('warns for the proper cases and with the right messages', async () => {
    const {warnings} = await linter.lint([`${ruleId}/before-fixes.html`]);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
  <form is="iron-form"></form>
        ~~~~~~~~~~~~~~`,
      `
  <div><form is="iron-form" with-credentials></form></div>
             ~~~~~~~~~~~~~~`,
      `
  <form is="iron-form"
        ~~~~~~~~~~~~~~`,
      `
      <form id="form" is="iron-form" with-credentials$="[[withCredentials]]">
                      ~~~~~~~~~~~~~~`,
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      `<form> should not be extended with \`is="iron-form"\` but instead wrapped with \`<iron-form>\`.`,
      `<form> should not be extended with \`is="iron-form"\` but instead wrapped with \`<iron-form>\`.`,
      `<form> should not be extended with \`is="iron-form"\` but instead wrapped with \`<iron-form>\`.`,
      `<form> should not be extended with \`is="iron-form"\` but instead wrapped with \`<iron-form>\`.`,
    ]);
  });

  test('applies automatic-safe fixes', async () => {
    await assertExpectedFixes(
        linter,
        analyzer,
        `${ruleId}/before-fixes.html`,
        `${ruleId}/after-fixes.html`);
  });
});
