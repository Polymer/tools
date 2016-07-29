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

'use strict';

const assert = require('chai').assert;
const parse5 = require('parse5');

const Analyzer = require('../../analyzer').Analyzer;
const HtmlDocument = require('../../html/html-document').HtmlDocument;
const HtmlScriptFinder =
    require('../../html/html-script-finder').HtmlScriptFinder;
const ImportDescriptor =
    require('../../ast/import-descriptor').ImportDescriptor;
const InlineDocumentDescriptor =
    require('../../ast/ast').InlineDocumentDescriptor;

suite('HtmlScriptFinder', () => {

  suite('findImports()', () => {
    let finder;

    setup(() => {
      let analyzer = new Analyzer({});
      finder = new HtmlScriptFinder(analyzer);
    });

    test('finds external and inline scripts', () => {
      let contents = `<html><head>
          <script src="foo.js"></script>
          <script>console.log('hi')</script>
        </head></html>`;
      let ast = parse5.parse(contents);
      let document = new HtmlDocument({
        url: 'test.html',
        contents,
        ast,
      });
      let promises = [];
      let visit = (visitor) => document.visit([visitor]);

      return finder.findEntities(document, visit).then((entities) => {
        assert.equal(entities.length, 2);
        assert.instanceOf(entities[0], ImportDescriptor);
        assert.equal(entities[0].type, 'html-script');
        assert.equal(entities[0].url, 'foo.js');
        assert.instanceOf(entities[1], InlineDocumentDescriptor);
        assert.equal(entities[1].type, 'js');
        assert.equal(entities[1].contents, `console.log('hi')`);
      });

    });

  });

});
