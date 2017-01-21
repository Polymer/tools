/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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
import {FSUrlLoader} from 'polymer-analyzer/lib/url-loader/fs-url-loader';
import {WarningPrinter} from 'polymer-analyzer/lib/warning/warning-printer';

import {MoveStyleIntoTemplate} from '../../html/move-style-into-template';
import {Linter} from '../../linter';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

suite('MoveStyleIntoTemplate', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrinter(null as any, {analyzer: analyzer});
    linter = new Linter([new MoveStyleIntoTemplate()], analyzer);
  });
  test('works in the trivial case', async() => {
    const warnings = await linter.lint([]);
    assert.deepEqual(warnings, []);
  });

  test('gives no warnings for a perfectly fine file', async() => {
    const warnings = await linter.lint(['perfectly-fine/polymer-element.html']);
    assert.deepEqual(warnings, []);
  });

  test('warns for a file with a style outside template', async() => {
    // Even without any rules we still get the warnings from the analyzer.
    const warnings = await linter.lint(
        ['move-style-into-template/style-child-of-dom-module.html']);
    assert.deepEqual(
        await Promise.all(warnings.map(
            async(w) =>
                '\n' + await warningPrinter.getUnderlinedText(w.sourceRange))),
        [`
  <style>
  ~~~~~~~
    * {color: red;}
~~~~~~~~~~~~~~~~~~~
  </style>
~~~~~~~~~~`]);
  });
});
