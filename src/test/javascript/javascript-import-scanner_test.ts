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

suite('JavaScriptImportScanner', () => {

  let parser = new JavaScriptParser({sourceType: 'module'});
  let scanner = new JavaScriptImportScanner();

  test('finds imports', async() => {
    let file = fs.readFileSync(
        path.resolve(__dirname, '../static/javascript/module.js'), 'utf8');
    let document = parser.parse(file, '/static/javascript/module.js');

    let visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));

    let features = await scanner.scan(document, visit);
    assert.equal(features.length, 1);
    assert.equal(features[0].type, 'js-import');
    assert.equal(features[0].url, '/static/javascript/submodule.js');
  });

  test('skips non-path imports', async() => {
    let file = fs.readFileSync(
        path.resolve(
            __dirname, '../static/javascript/module-with-named-import.js'),
        'utf8');
    let document =
        parser.parse(file, '/static/javascript/module-with-named-import.js');

    let visit = (visitor: Visitor) =>
        Promise.resolve(document.visit([visitor]));

    let features = await scanner.scan(document, visit);
    assert.equal(features.length, 0);
  });

});
