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

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

suite('deprecated-css-custom-property-syntax', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrettyPrinter();
    linter = new Linter(
        registry.getRules(['deprecated-css-custom-property-syntax']), analyzer);
  });

  test('works in the trivial case', async() => {
    const warnings = await linter.lint([]);
    assert.deepEqual(warnings, []);
  });

  test('gives no warnings for a perfectly fine file', async() => {
    const warnings = await linter.lint(['perfectly-fine/polymer-element.html']);
    assert.deepEqual(warnings, []);
  });

  test('warns for the proper cases and with the right messages', async() => {
    const warnings = await linter.lint([
      'deprecated-css-custom-property-syntax/deprecated-css-custom-property-syntax.html'
    ]);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
    color: var(--red, --blue);
                      ~~~~~~`,
      `
    color: #33var(  --high  , --low  )33;
                              ~~~~~`,
      `
    @apply(--foo);
          ~~~~~~~`,
      `
      @apply(--bar);
            ~~~~~~~`,
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      `When the second argument to a var() expression is another custom property, it must also be wrapped in a var().`,
      `When the second argument to a var() expression is another custom property, it must also be wrapped in a var().`,
      '@apply with parentheses is deprecated. Prefer: @apply --foo;',
      '@apply with parentheses is deprecated. Prefer: @apply --foo;'
    ]);
  });

  test('applies automatic-safe fixes', async() => {
    const warnings = await linter.lint(
        ['deprecated-css-custom-property-syntax/before-fixes.html']);
    const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
    const loader = makeParseLoader(analyzer, await analyzer.analyze([]));
    const result = await applyEdits(edits, loader);
    assert.deepEqual(
        result.editedFiles.get(
            'deprecated-css-custom-property-syntax/before-fixes.html'),
        (await loader('deprecated-css-custom-property-syntax/after-fixes.html'))
            .contents);
    assert.deepEqual(result.incompatibleEdits, []);
  });
});
