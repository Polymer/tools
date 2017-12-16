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

import {HtmlParser} from '../../html/html-parser';
import {Analyzer} from '../../index';
import {PackageUrlResolver} from '../../url-loader/package-url-resolver';
import {fixtureDir, resolvedUrl} from '../test-utils';

suite('HtmlParser', () => {
  suite('parse()', () => {
    let parser: HtmlParser;

    setup(() => {
      parser = new HtmlParser();
    });

    suite('on a well-formed document', () => {
      const file = fs.readFileSync(
          path.resolve(fixtureDir, 'html-parse-target.html'), 'utf8');

      test('parses a well-formed document', () => {
        const document = parser.parse(
            file,
            resolvedUrl`/static/html-parse-target.html`,
            new PackageUrlResolver());
        assert.equal(document.url, '/static/html-parse-target.html');
      });

      test('can stringify back a well-formed document', () => {
        const document = parser.parse(
            file,
            resolvedUrl`/static/html-parse-target.html`,
            new PackageUrlResolver());
        assert.deepEqual(document.stringify(), file);
      });
    });

    test('can properly determine the base url of a document', async () => {
      const analyzer =
          Analyzer.createForDirectory(path.resolve(fixtureDir, '../'));
      const resolvedPath =
          analyzer.resolveUrl(`static/base-href/doc-with-base.html`)!;
      const file = await analyzer.load(resolvedPath);
      const document =
          parser.parse(file, resolvedPath, new PackageUrlResolver());
      assert.equal(document.url, resolvedPath);
      assert.equal(document.baseUrl, analyzer.resolveUrl('static/'));
    });
  });
});
