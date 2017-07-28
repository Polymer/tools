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

import {convertDocumentUrl, ConvertedDocumentUrl, getRelativeUrl, OriginalDocumentUrl} from '../url-converter';

suite('src/url-converter', () => {

  suite('convertDocumentUrl()', () => {

    test('converts a local html url to expected js url', () => {
      assert.equal(
          convertDocumentUrl('foo.html' as OriginalDocumentUrl), './foo.js');
      assert.equal(
          convertDocumentUrl('foo/foo.html' as OriginalDocumentUrl),
          './foo/foo.js');
    });

    test(
        'converts a bower_components/ (external) html url to expected js url',
        () => {
          assert.equal(
              convertDocumentUrl(
                  'bower_components/polymer/polymer.html' as
                  OriginalDocumentUrl),
              './node_modules/@polymer/polymer/polymer.js');
          assert.equal(
              convertDocumentUrl(
                  'bower_components/paper-item/src/paper-item.html' as
                  OriginalDocumentUrl),
              './node_modules/@polymer/paper-item/src/paper-item.js');
          assert.equal(
              convertDocumentUrl(
                  'bower_components/promise-polyfill/promise-polyfill.html' as
                  OriginalDocumentUrl),
              './node_modules/@polymer/promise-polyfill/promise-polyfill.js');
        });


    test('handles special whitelisted url conversions', () => {
      assert.equal(
          convertDocumentUrl(
              'bower_components/shadycss/apply-shim.html' as
              OriginalDocumentUrl),
          './node_modules/@webcomponents/shadycss/entrypoints/apply-shim.js');
      assert.equal(
          convertDocumentUrl(
              'bower_components/shadycss/custom-style-interface.html' as
              OriginalDocumentUrl),
          './node_modules/@webcomponents/shadycss/entrypoints/custom-style-interface.js');
    });

  });

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
      }, 'paths relative to package root expected (actual: from="../foo.js", to="./bar.js")');
    });

  });

});
