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
import * as parse5 from 'parse5';

import {InlineDocumentDescriptor} from '../../ast/ast';
import {ImportDescriptor} from '../../ast/import-descriptor';
import {HtmlDocument, HtmlVisitor} from '../../html/html-document';
import {HtmlScriptFinder} from '../../html/html-script-finder';

suite('HtmlScriptFinder', () => {

  suite('findImports()', () => {
    let finder: HtmlScriptFinder;

    setup(() => {
      finder = new HtmlScriptFinder();
    });

    test('finds external and inline scripts', async() => {
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
      let visit = async(visitor: HtmlVisitor) => document.visit([visitor]);

      const entities = await finder.findEntities(document, visit);
      assert.equal(entities.length, 2);
      assert.instanceOf(entities[0], ImportDescriptor);
      const entity0 = <ImportDescriptor<any>>entities[0];
      assert.equal(entity0.type, 'html-script');
      assert.equal(entity0.url, 'foo.js');
      assert.instanceOf(entities[1], InlineDocumentDescriptor);
      const entity1 = <InlineDocumentDescriptor<any>>entities[1];
      assert.equal(entity1.type, 'js');
      assert.equal(entity1.contents, `console.log('hi')`);

    });

  });

});
