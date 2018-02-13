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

import {ScannedPolymerElement} from '../../polymer/polymer-element';
import {PseudoElementScanner} from '../../polymer/pseudo-element-scanner';
import {fileRelativeUrl, runScannerOnContents} from '../test-utils';

suite('PseudoElementScanner', () => {
  test('finds pseudo elements in html comments ', async () => {
    const desc = `This is a pseudo element`;
    const contents = `<html><head></head><body>
          <!--
          ${desc}
          @pseudoElement x-foo
          @demo demo/index.html
          -->
        </body>
        </html>`;
    const {features} = await runScannerOnContents(
        new PseudoElementScanner(), 'test-doc.html', contents);
    assert.deepEqual(
        features.map(
            (f: ScannedPolymerElement) =>
                [f.tagName, f.pseudo, f.description.trim(), f.demos]),
        [[
          'x-foo',
          true,
          desc,
          [{desc: 'demo', path: fileRelativeUrl`demo/index.html`}]
        ]]);
  });
});
