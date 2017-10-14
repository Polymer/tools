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
import {Analyzer, FSUrlLoader} from 'polymer-analyzer';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {applyEdits, makeParseLoader} from '../../warning';
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

suite('content-to-slot', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrettyPrinter();
    linter = new Linter(registry.getRules(['content-to-slot']), analyzer);
  });

  test('works in the trivial case', async() => {
    const warnings = await linter.lint([]);
    assert.deepEqual(warnings, []);
  });

  test('applies automatic-safe fixes', async() => {
    const warnings = await linter.lint(['content-to-slot/before-fixes.html']);
    const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
    const loader = makeParseLoader(analyzer);
    const result = await applyEdits(edits, loader);
    assert.deepEqual(
        result.editedFiles.get('content-to-slot/before-fixes.html'),
        (await loader('content-to-slot/after-fixes.html')).contents);
  });
});
