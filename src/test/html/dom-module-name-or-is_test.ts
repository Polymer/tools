/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {DomModuleNameOrIs} from '../../html/dom-module-name-or-is';
import {Linter} from '../../linter';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

suite('DomModuleNameOrIs', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrinter(null as any, {analyzer: analyzer});
    linter = new Linter([new DomModuleNameOrIs()], analyzer);
  });
  test('works in the trivial case', async() => {
    const warnings = await linter.lint([]);
    assert.deepEqual(warnings, []);
  });

  test('gives no warnings for a perfectly fine file', async() => {
    const warnings = await linter.lint(['perfectly-fine/polymer-element.html']);
    assert.deepEqual(warnings, []);
  });

  test('warns for a file "is" and "name" dom-modules', async() => {
    const warnings =
        await linter.lint(['dom-module-name-or-is/dom-module-name-or-is.html']);
    assert.deepEqual(
        await Promise.all(warnings.map(
            async(w) =>
                '\n' + await warningPrinter.getUnderlinedText(w.sourceRange))),
        [
          `
<dom-module name="foo-elem">
            ~~~~`,
          `
<dom-module is="bar-elem">
            ~~`,
          `
<dom-module name="baz-elem" is="zod-elem">
                            ~~`,
          `
<dom-module name="baz-elem" is="zod-elem">
            ~~~~`,
        ]);
  });
});
