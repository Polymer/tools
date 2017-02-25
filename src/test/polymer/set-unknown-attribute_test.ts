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
import {FSUrlLoader} from 'polymer-analyzer/lib/url-loader/fs-url-loader';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.resolve(path.join(__dirname, '../../../test'));

suite('set-unknown-attribute', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(() => {
    analyzer = new Analyzer({urlLoader: new FSUrlLoader(fixtures_dir)});
    warningPrinter = new WarningPrettyPrinter(analyzer);
    linter = new Linter(registry.getRules(['set-unknown-attribute']), analyzer);
  });

  test('works in the trivial case', async() => {
    const warnings = await linter.lint([]);
    assert.deepEqual(warnings, []);
  });

  test('gives no warnings for a perfectly fine file', async() => {
    const warnings = await linter.lint(['perfectly-fine/polymer-element.html']);
    assert.deepEqual(warnings, []);
  });

  test('warns at the right times', async() => {
    const warnings =
        await linter.lint(['set-unknown-attribute/when-to-warn.html']);
    assert.deepEqual(await warningPrinter.prettyPrint(warnings), [
      `
    <elem-one unknown="not ok"></elem-one>
              ~~~~~~~`,
      `
    <elem-one attr-one="{{bad}}"></elem-one>
              ~~~~~~~~`,
      `
    <elem-one data-whatever="{{isError}}"></elem-one>
              ~~~~~~~~~~~~~`,
      `
    <elem-one class="{{nonono}}" style="{{dontDoThis}}"></elem-one>
              ~~~~~`,
      `
    <elem-one class="{{nonono}}" style="{{dontDoThis}}"></elem-one>
                                 ~~~~~`,
      `
    <elem-two propTwo="not ok"></elem-two>
              ~~~~~~~`,
      `
    <elem-two propTwo="{{also.not.ok}}"></elem-two>
              ~~~~~~~`,
      `
<elem-one unknown="warns even outside databindings"></elem-one>
          ~~~~~~~`
    ]);
  });

  test('gives helpful warning messages', async() => {
    const warnings =
        await linter.lint(['set-unknown-attribute/warning-messages.html']);
    assert.deepEqual(warnings.map((w) => w.message), [
      'test-elem elements do not have an attribute named bazic. Consider instead:  basic',
      'test-elem elements do not have an attribute named multiword. Consider instead:  multi-word',
      'test-elem elements do not have an attribute named ib. Consider instead:  id',
      'test-elem elements do not have an attribute named tattle. Consider instead:  title',
      'test-elem elements do not have a property named class. Consider instead:  class$',
      'data-* attributes must be accessed as attributes. i.e. you must write:  data-foo$="{{dont.do.this}}"'
    ]);
  });
});
