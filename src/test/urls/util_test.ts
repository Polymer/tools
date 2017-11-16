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

import {ConvertedDocumentUrl} from '../../urls/types';
import {getRelativeUrl} from '../../urls/util';

suite('src/url-handler', () => {

  suite('getRelativeUrl()', () => {

    test('handles two root urls relative to the same directory', () => {
      assert.equal(
          getRelativeUrl(
              './foo.js' as ConvertedDocumentUrl,
              './bar.js' as ConvertedDocumentUrl),
          './bar.js');
      assert.equal(
          getRelativeUrl(
              './foo/foo.js' as ConvertedDocumentUrl,
              './bar.js' as ConvertedDocumentUrl),
          '../bar.js');
      assert.equal(
          getRelativeUrl(
              './foo/foo.js' as ConvertedDocumentUrl,
              './bar/bar.js' as ConvertedDocumentUrl),
          '../bar/bar.js');
    });

    test('explicitly does not handle sibling/parent urls', () => {
      assert.throws(() => {
        getRelativeUrl(
            '../foo.js' as ConvertedDocumentUrl,
            './bar.js' as ConvertedDocumentUrl);
      }, `paths relative to package root expected (actual: from="../foo.js", to="./bar.js")`);
    });

  });

});
