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
import * as dom5 from 'dom5';
import * as fs from 'fs';
import * as parse5 from 'parse5';
import * as path from 'path';
import {HtmlParser} from '../../html/html-parser';
import {ParsedHtmlDocument} from '../../html/html-document';

suite('ParsedHtmlDocument', () => {

  suite('sourceRangeForNode()', () => {
    const parser: HtmlParser = new HtmlParser();
    const url = '/static/source-ranges/html-complicated.html';
    const file = fs.readFileSync(
        path.resolve(__dirname, `../${url}`), 'utf8');
    const document: ParsedHtmlDocument = parser.parse(file, url);

    test('can report correct range for comments', () => {
      const comments = dom5.nodeWalkAll(document.ast,
          parse5.treeAdapters.default.isCommentNode);

      assert.equal(comments.length, 2);
      assert.deepEqual(document.sourceRangeForNode(comments![0]!), {
        file: url, start: {line: 16, column: 4}, end: {line: 16, column: 32}
      });

      console.log(comments![1]!);

      assert.deepEqual(document.sourceRangeForNode(comments![1]!), {
        file: url, start: {line: 17, column: 4}, end: {line: 19, column: 20}
      });
    });

    test.skip('can report correct range for elements', () => {
      // TODO(usergenic): If element source range includes their children,
      // shouldn't they extend to include their closing tag as well?  They
      // don't do so currently.  Add test after we discuss/and/or fix.
    });

    test('can report correct range for text nodes', () => {
      const titleTag = dom5.query(document.ast,
          dom5.predicates.hasTagName('title'))!;

      // The <title> tag text node child is multiple lines and the end tag is
      // indented 8 spaces.
      assert.deepEqual(document.sourceRangeForNode(titleTag!.childNodes![0]!), {
        file: url, start: {line: 3, column: 11}, end: {line: 6, column: 8}
      });

      const pTags = dom5.queryAll(document.ast,
          dom5.predicates.hasTagName('p'));
      assert.equal(pTags.length, 2);

      // The first <p> tag text node child is multiple lines and there is no
      // end tag.  The next <p> tag is indended 4 spaces.
      assert.deepEqual(document.sourceRangeForNode(pTags[0]!.childNodes![0]!), {
        file: url, start: {line: 13, column: 7}, end: {line: 15, column: 4}
      });

      // The second <p> tag text node child is single line, terminated by a
      // closing tag.
      assert.deepEqual(document.sourceRangeForNode(pTags[1]!.childNodes![0]!), {
        file: url, start: {line: 15, column: 7}, end: {line: 15, column: 46}
      });
    });
  });
});
