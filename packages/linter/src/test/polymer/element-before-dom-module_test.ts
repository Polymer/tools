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
import '../../rules';

import {assert} from 'chai';
import * as path from 'path';
import {Analyzer} from 'polymer-analyzer';
import {ProjectConfig} from 'polymer-project-config';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

suite('element-before-dom-module', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(async () => {
    ({analyzer} =
         await ProjectConfig.initializeAnalyzerFromDirectory(fixtures_dir));
    warningPrinter = new WarningPrettyPrinter();
    linter =
        new Linter(registry.getRules(['element-before-dom-module']), analyzer);
  });

  test('works in the trivial case', async () => {
    const {warnings} = await linter.lint([]);
    assert.deepEqual([...warnings], []);
  });

  test('gives no warnings for a perfectly fine file', async () => {
    const {warnings} =
        await linter.lint(['perfectly-fine/polymer-element.html']);
    assert.deepEqual([...warnings], []);
  });

  test('warns for the proper cases', async () => {
    const {warnings} = await linter.lint(
        ['element-before-dom-module/element-before-dom-module.html']);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
<dom-module id='el-5'></dom-module>
~~~~~~~~~~~~~~~~~~~~~~`,
      `
<dom-module id='el-6'></dom-module>
~~~~~~~~~~~~~~~~~~~~~~`,
      `
<dom-module id='el-7'>
~~~~~~~~~~~~~~~~~~~~~~`,
      `
<dom-module id='el-8'>
~~~~~~~~~~~~~~~~~~~~~~`
    ]);
  });
});
