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
import {Analyzer, Severity} from 'polymer-analyzer';
import {ProjectConfig} from 'polymer-project-config';

import {Linter} from '../../linter';
import {registry} from '../../registry';
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');
const ruleId = 'validate-element-name';

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

  test('gives no warnings for a perfectly fine file', async() => {
    const {warnings} =
        await linter.lint(['perfectly-fine/polymer-element.html']);
    assert.deepEqual([...warnings], []);
  });

  test('warns for the proper cases and with the right messages', async() => {
    const {warnings} = await linter.lint([`${ruleId}/${ruleId}.html`]);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
        return 'test-App';
               ~~~~~~~~~~`,
      `
      is: 'app'
          ~~~~~`,
      `
      is: '1-app'
          ~~~~~~~`,
      `
      is: '-app'
          ~~~~~~`,
      `
      is: 'my-app!'
          ~~~~~~~~~`,
      `
      is: 'font-face'
          ~~~~~~~~~~~`,
      `
      is: 'polymer-app'
          ~~~~~~~~~~~~~`,
      `
      is: 'x-app'
          ~~~~~~~`,
      `
      is: 'ng-app'
          ~~~~~~~~`,
      `
      is: 'xml-app'
          ~~~~~~~~~`,
      `
      is: 'my-app-'
          ~~~~~~~~~`,
      `
      is: 'my--app'
          ~~~~~~~~~`,
    ]);

    assert.deepEqual(
        warnings.map(({message, severity}) => ({message, severity})), [
          {
            message:
                'Custom element names must not contain uppercase ASCII characters.',
            severity: Severity.ERROR,
          },
          {
            message:
                'Custom element names must contain a hyphen. Example: unicorn-cake',
            severity: Severity.ERROR,
          },
          {
            message: 'Custom element names must not start with a digit.',
            severity: Severity.ERROR,
          },
          {
            message: 'Custom element names must not start with a hyphen.',
            severity: Severity.ERROR,
          },
          {
            message: 'Invalid element name.',
            severity: Severity.ERROR,
          },
          {
            message:
                'The supplied element name is reserved and can\'t be used.\nSee: https://html.spec.whatwg.org/multipage/scripting.html#valid-custom-element-name',
            severity: Severity.ERROR,
          },
          {
            message:
                'Custom element names should not start with `polymer-`.\nSee: http://webcomponents.github.io/articles/how-should-i-name-my-element',
            severity: Severity.WARNING,
          },
          {
            message:
                'Custom element names should not start with `x-`.\nSee: http://webcomponents.github.io/articles/how-should-i-name-my-element/',
            severity: Severity.WARNING,
          },
          {
            message:
                'Custom element names should not start with `ng-`.\nSee: http://docs.angularjs.org/guide/directive#creating-directives',
            severity: Severity.WARNING,
          },
          {
            message: 'Custom element names should not start with `xml`.',
            severity: Severity.WARNING,
          },
          {
            message: 'Custom element names should not end with a hyphen.',
            severity: Severity.WARNING,
          },
          {
            message:
                'Custom element names should not contain consecutive hyphens.',
            severity: Severity.WARNING,
          }
        ]);
  });
});
