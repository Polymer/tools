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
import * as fs from 'fs';
import * as path from 'path';

import {Visitor} from '../../javascript/estree-visitor';
import {JavaScriptImportScanner} from '../../javascript/javascript-import-scanner';
import {JavaScriptParser} from '../../javascript/javascript-parser';
import {ResolvedUrl} from '../../model/url';

suite('JavaScriptImportScanner', () => {
  const parser = new JavaScriptParser();
  const scanner = new JavaScriptImportScanner();

  test('finds imports', async () => {
    const file = fs.readFileSync(
        path.resolve(__dirname, '../static/javascript/module.js'), 'utf8');
    const document =
        parser.parse(file, '/static/javascript/module.js' as ResolvedUrl);

    const visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));

    const {features} = await scanner.scan(document, visit);
    assert.containSubset(features, [
      {
        type: 'js-import',
        url: '/static/javascript/submodule.js',
        lazy: false,
      },
    ]);
  });

  test('finds dynamic imports', async () => {
    const file = fs.readFileSync(
        path.resolve(__dirname, '../static/javascript/dynamic-import.js'),
        'utf8');
    const document = parser.parse(
        file, '/static/javascript/dynamic-import.js' as ResolvedUrl);

    const visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));

    const {features} = await scanner.scan(document, visit);
    assert.containSubset(features, [
      {
        type: 'js-import',
        url: '/static/javascript/submodule.js',
        lazy: true,
      },
    ]);
  });

  test('skips non-path imports', async () => {
    const file = fs.readFileSync(
        path.resolve(
            __dirname, '../static/javascript/module-with-named-import.js'),
        'utf8');
    const document = parser.parse(
        file, '/static/javascript/module-with-named-import.js' as ResolvedUrl);

    const visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));

    const {features} = await scanner.scan(document, visit);
    assert.equal(features.length, 0);
  });
});
