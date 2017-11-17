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
import {Analyzer, applyEdits, FSUrlLoader, makeParseLoader} from 'polymer-analyzer';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.resolve(path.join(__dirname, '../../../test'));

const code = 'style-into-template';

suite(code, () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrettyPrinter();
    linter = new Linter(registry.getRules([code]), analyzer);
  });

  test('works in the trivial case', async() => {
    const warnings = await linter.lint([]);
    assert.deepEqual([...warnings], []);
  });

  test('gives no warnings for a perfectly fine file', async() => {
    const warnings = await linter.lint(['perfectly-fine/polymer-element.html']);
    assert.deepEqual([...warnings], []);
  });

  test('warns for a file with a style outside template', async() => {
    const warnings =
        await linter.lint([`${code}/style-child-of-dom-module.html`]);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
  <link rel="import" href="./bar.css">
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
  <link rel="import" type="css" href="./foo.css">
  ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
  <style>
  ~~~~~~~`,
    ]);
  });

  test('applies automatic-safe fixes', async() => {
    const warnings = await linter.lint([`${code}/before-fixes.html`]);
    const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
    const loader = makeParseLoader(analyzer, warnings.analysis);
    const result = await applyEdits(edits, loader);
    assert.deepEqual(result.incompatibleEdits, []);
    assert.deepEqual(
        result.editedFiles.get(`${code}/before-fixes.html`),
        (await loader(`${code}/after-fixes.html`)).contents);
  });
});
