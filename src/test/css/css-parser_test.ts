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

import {ParsedCssDocument} from '../../css/css-document';
import {CssParser} from '../../css/css-parser';
import {ResolvedUrl} from '../../model/url';

suite('CssParser', () => {
  suite('parse()', () => {
    const fileContents = fs.readFileSync(
        path.resolve(__dirname, '../static/stylesheet.css'), 'utf8');

    let parser: CssParser;

    setup(() => {
      parser = new CssParser();
    });

    test('parses css', () => {
      const document =
          parser.parse(fileContents, '/static/stylesheet.css' as ResolvedUrl);
      assert.instanceOf(document, ParsedCssDocument);
      assert.equal(document.url, '/static/stylesheet.css');
      assert(document.ast != null);
    });

    test('stringifies css', () => {
      const document =
          parser.parse(fileContents, '/static/stylesheet.css' as ResolvedUrl);
      assert.deepEqual(document.stringify(), fileContents);
    });
  });
});
