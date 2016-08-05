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

import {CssDocument} from '../../css/css-document';
import {CssParser} from '../../css/css-parser';

suite('CssParser', () => {

  suite('parse()', () => {
    let parser: CssParser;

    setup(() => {
      parser = new CssParser(<any>{
        // These aren't method shorthand because clang-format misformats them.
        findImports: function(url: string, document: CssDocument): Array<any> {
          return [];
        },
        parse: function(type: any, content: any, url: any): void {
          return <any>null;
        },
      });
    });

    test('parses css', () => {
      let file = fs.readFileSync(
          path.resolve(__dirname, '../static/stylesheet.css'), 'utf8');
      let document = parser.parse(file, '/static/stylesheet.css');
      assert.instanceOf(document, CssDocument);
      assert.equal(document.url, '/static/stylesheet.css');
      assert(document.ast != null);
    });

  });

});
