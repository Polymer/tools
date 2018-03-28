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
import {WarningPrettyPrinter} from '../util';

const fixtures_dir = path.join(__dirname, '..', '..', '..', 'test');

suite('call-super-in-callbacks', () => {
  let analyzer: Analyzer;
  let warningPrinter: WarningPrettyPrinter;
  let linter: Linter;

  setup(async() => {
    ({analyzer} =
         await ProjectConfig.initializeAnalyzerFromDirectory(fixtures_dir));
    warningPrinter = new WarningPrettyPrinter();
    linter =
        new Linter(registry.getRules(['call-super-in-callbacks']), analyzer);
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
    const {warnings} = await linter.lint(
        ['call-super-in-callbacks/call-super-in-callbacks.html']);
    assert.deepEqual(warningPrinter.prettyPrint(warnings), [
      `
    constructor() {/* BadSuper */ }
    ~~~~~~~~~~~`,
      `
    connectedCallback() { /* BadSuper */ }
    ~~~~~~~~~~~~~~~~~`,
      `
    disconnectedCallback() {/* BadSuper */ }
    ~~~~~~~~~~~~~~~~~~~~`,
      `
    attributeChangedCallback() {/* BadSuper */ }
    ~~~~~~~~~~~~~~~~~~~~~~~~`,
      `
    connectedCallback() { /* ReassignedBad */ }
    ~~~~~~~~~~~~~~~~~`,
      `
    connectedCallback() { /* BadMixin1 */ }
    ~~~~~~~~~~~~~~~~~`,
      `
    connectedCallback() { /* BadMixin2 */ }
    ~~~~~~~~~~~~~~~~~`,
      `
    disconnectedCallback() { /* BadMixin2 */ }
    ~~~~~~~~~~~~~~~~~~~~`,
      `
      connectedCallback() { /** BadMixinConnected */ }
      ~~~~~~~~~~~~~~~~~`
    ]);

    assert.deepEqual(warnings.map((w) => w.message), [
      'ES6 requires super() in constructors with superclasses.',
      'You may need to call super.connectedCallback() because BadSuper extends SuperClass, which defines connectedCallback too.',
      'You may need to call super.disconnectedCallback() because BadSuper extends SuperClass, which defines disconnectedCallback too.',
      'You may need to call super.attributeChangedCallback() because BadSuper extends SuperClass, which defines attributeChangedCallback too.',
      'You may need to call super.connectedCallback() because ReassignedBad extends SuperClass, which defines connectedCallback too.',
      'You may need to call super.connectedCallback() because BadMixin1 extends MixinConnected, which defines connectedCallback too.',
      'You may need to call super.connectedCallback() because BadMixin2 extends MixinConnected, which defines connectedCallback too.',
      'You may need to call super.disconnectedCallback() because BadMixin2 extends MixinConnectedAndDisconnected, which defines disconnectedCallback too.',
      `This method should conditionally call super.connectedCallback() ` +
          `because a class BadMixinConnected is applied to may also define ` +
          `connectedCallback.`,
    ]);
  });
});
