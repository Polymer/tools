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
import * as dom5 from 'dom5/lib/index-next';
import * as fs from 'fs';
import * as parse5 from 'parse5';
import * as path from 'path';

import {Analyzer} from '../../core/analyzer';
import {ParsedHtmlDocument} from '../../html/html-document';
import {HtmlParser} from '../../html/html-parser';
import {PackageUrlResolver} from '../../url-loader/package-url-resolver';
import {CodeUnderliner, createForDirectory, fixtureDir} from '../test-utils';

suite('ParsedHtmlDocument', () => {
  const parser: HtmlParser = new HtmlParser();
  const url = `./source-ranges/html-complicated.html`;
  const file = fs.readFileSync(path.join(fixtureDir, url), 'utf8');
  let analyzer: Analyzer;
  let underliner: CodeUnderliner;
  before(async () => {
    ({analyzer, underliner} = await createForDirectory(fixtureDir));
  });

  let document: ParsedHtmlDocument;
  setup(() => {
    document =
        parser.parse(file, analyzer.resolveUrl(url)!, analyzer.urlResolver);
  });

  suite('sourceRangeForNode()', () => {
    test('works for comments', async () => {
      const comments = [...dom5.depthFirst(document.ast)].filter(
          parse5.treeAdapters.default.isCommentNode);

      assert.equal(comments.length, 2);
      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(comments![0])),
          `
    <!-- Single Line Comment -->
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(comments![1])),
          `
    <!-- Multiple
    ~~~~~~~~~~~~~
         Line
~~~~~~~~~~~~~
         Comment -->
~~~~~~~~~~~~~~~~~~~~`);
    });

    test('works for elements', async () => {
      const liTags =
          [...dom5.queryAll(document.ast, dom5.predicates.hasTagName('li'))];

      assert.equal(liTags.length, 4);

      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(liTags[0]!)!),
          `
        <li>1
        ~~~~~
        <li>2</li>
~~~~~~~~`);

      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(liTags[1]!)!),
          `
        <li>2</li>
        ~~~~~~~~~~`);

      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(liTags[2]!)), `
        <li><li>
        ~~~~`);

      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(liTags[3]!)), `
        <li><li>
            ~~~~
      </ul>
~~~~~~`);

      const pTags =
          [...dom5.queryAll(document.ast, dom5.predicates.hasTagName('p'))];
      assert.equal(pTags.length, 2);

      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(pTags[0]!)), `
    <p>
    ~~~
      This is a paragraph without a closing tag.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    <p>This is a paragraph with a closing tag.</p>
~~~~`);

      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(pTags[1]!)), `
    <p>This is a paragraph with a closing tag.</p>
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
    });

    const testName =
        'works for unclosed tags with attributes and no text content';
    test(testName, async () => {
      const url = analyzer.resolveUrl(`unclosed-tag-attributes.html`)!;
      const document = parser.parse(
          await analyzer.load(url),
          url,
          new PackageUrlResolver({packageDir: fixtureDir}));

      const tag = dom5.query(document.ast, dom5.predicates.hasTagName('tag'))!;
      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(tag)), `
<tag attr>
~~~~~~~~~~`);
    });

    test('works for void elements', async () => {
      const linkTags =
          [...dom5.queryAll(document.ast, dom5.predicates.hasTagName('link'))];
      assert.equal(linkTags.length, 2);

      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(linkTags[0]!)),
          `
    <link rel="has attributes">
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

      assert.deepEqual(
          await underliner.underline(document.sourceRangeForNode(linkTags[1]!)),
          `
    <link rel="multiline ones too"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
          foo=bar>
~~~~~~~~~~~~~~~~~~`);
    });

    test('works for text nodes', async () => {
      const titleTag =
          dom5.query(document.ast, dom5.predicates.hasTagName('title'))!;

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForNode(titleTag!.childNodes![0]!)),
          `
    <title>
           ~
      This title is a little
~~~~~~~~~~~~~~~~~~~~~~~~~~~~
      complicated.
~~~~~~~~~~~~~~~~~~
        </title>
~~~~~~~~`);

      const pTags =
          [...dom5.queryAll(document.ast, dom5.predicates.hasTagName('p'))];
      assert.equal(pTags.length, 2);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForNode(pTags[0]!.childNodes![0]!)),
          `
    <p>
       ~
      This is a paragraph without a closing tag.
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
    <p>This is a paragraph with a closing tag.</p>
~~~~`);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForNode(pTags[1]!.childNodes![0]!)),
          `
    <p>This is a paragraph with a closing tag.</p>
       ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
    });
  });

  suite('sourceRangeForStartTag', () => {
    test('it works for tags with no attributes', async () => {
      const liTags =
          [...dom5.queryAll(document.ast, dom5.predicates.hasTagName('li'))];

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForStartTag(liTags[0]!)),
          `
        <li>1
        ~~~~`);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForStartTag(liTags[1]!)),
          `
        <li>2</li>
        ~~~~`);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForStartTag(liTags[2]!)),
          `
        <li><li>
        ~~~~`);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForStartTag(liTags[3]!)),
          `
        <li><li>
            ~~~~`);
    });

    test('it works for void tags with no attributes', async () => {
      const brTags =
          [...dom5.queryAll(document.ast, dom5.predicates.hasTagName('br'))];
      assert.equal(brTags.length, 1);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForStartTag(brTags[0]!)),
          `
    <br>
    ~~~~`);
    });

    test('it works for void tags with attributes', async () => {
      const linkTags =
          [...dom5.queryAll(document.ast, dom5.predicates.hasTagName('link'))];
      assert.equal(linkTags.length, 2);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForStartTag(linkTags[0]!)),
          `
    <link rel="has attributes">
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~`);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForStartTag(linkTags[1]!)),
          `
    <link rel="multiline ones too"
    ~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
          foo=bar>
~~~~~~~~~~~~~~~~~~`);
    });

    test('it works for normal elements with attributes', async () => {
      const h1Tags =
          [...dom5.queryAll(document.ast, dom5.predicates.hasTagName('h1'))];
      assert.equal(h1Tags.length, 2);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForStartTag(h1Tags[1]!)),
          `
    <h1 class="foo" id="bar">
    ~~~~~~~~~~~~~~~~~~~~~~~~~`);

      const complexTags = [...dom5.queryAll(
          document.ast, dom5.predicates.hasTagName('complex-tag'))];
      assert.equal(complexTags.length, 1);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForStartTag(complexTags[0]!)),
          `
    <complex-tag boolean-attr
    ~~~~~~~~~~~~~~~~~~~~~~~~~
                 string-attr="like this"
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                 multi-line-attr="
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    can go on
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    for multiple lines
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                "
~~~~~~~~~~~~~~~~~
                whitespace-around-equals
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                =
~~~~~~~~~~~~~~~~~
                "yes this is legal">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
    });
  });
  suite('sourceRangeForEndTag', () => {
    test('it works for normal elements', async () => {
      const h1Tags =
          [...dom5.queryAll(document.ast, dom5.predicates.hasTagName('h1'))];
      assert.equal(h1Tags.length, 2);

      assert.deepEqual(
          await underliner.underline(document.sourceRangeForEndTag(h1Tags[1]!)),
          `
    </h1>
    ~~~~~`);

      const complexTags = [...dom5.queryAll(
          document.ast, dom5.predicates.hasTagName('complex-tag'))];
      assert.equal(complexTags.length, 1);

      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForEndTag(complexTags[0]!)),
          `
    </complex-tag
    ~~~~~~~~~~~~~
      >
~~~~~~~`);
    });
  });

  suite('sourceRangeForAttribute', () => {
    let complexTags: parse5.ASTNode[];
    setup(() => {
      complexTags = [...dom5.queryAll(
          document.ast, dom5.predicates.hasTagName('complex-tag'))];
      assert.equal(complexTags.length, 1);
    });


    test('works for boolean attributes', async () => {
      assert.deepEqual(
          await underliner.underline(document.sourceRangeForAttribute(
              complexTags[0]!, 'boolean-attr')),
          `
    <complex-tag boolean-attr
                 ~~~~~~~~~~~~`);
    });

    test('works for one line string attributes', async () => {
      assert.deepEqual(
          await underliner.underline(
              document.sourceRangeForAttribute(complexTags[0]!, 'string-attr')),
          `
                 string-attr="like this"
                 ~~~~~~~~~~~~~~~~~~~~~~~`);
    });

    test('works for multiline string attributes', async () => {
      assert.deepEqual(
          await underliner.underline(document.sourceRangeForAttribute(
              complexTags[0]!, 'multi-line-attr')),
          `
                 multi-line-attr="
                 ~~~~~~~~~~~~~~~~~
                    can go on
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    for multiple lines
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                "
~~~~~~~~~~~~~~~~~`);
    });

    test(
        'works for attributes with whitespace around the equals sign',
        async () => {
          assert.deepEqual(
              await underliner.underline(document.sourceRangeForAttribute(
                  complexTags[0]!, 'whitespace-around-equals')),
              `
                whitespace-around-equals
                ~~~~~~~~~~~~~~~~~~~~~~~~
                =
~~~~~~~~~~~~~~~~~
                "yes this is legal">
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~`);
        });

    suite('for a void element', () => {
      test('works for a string attribute', async () => {
        const linkTags = [...dom5.queryAll(
            document.ast, dom5.predicates.hasTagName('link'))];
        assert.equal(linkTags.length, 2);

        assert.deepEqual(
            await underliner.underline(
                document.sourceRangeForAttribute(linkTags[0]!, 'rel')),
            `
    <link rel="has attributes">
          ~~~~~~~~~~~~~~~~~~~~`);

        assert.deepEqual(
            await underliner.underline(
                document.sourceRangeForAttribute(linkTags[1]!, 'foo')),
            `
          foo=bar>
          ~~~~~~~`);
      });
    });
  });

  suite('sourceRangeForAttributeName', () => {
    let complexTags: parse5.ASTNode[];
    setup(() => {
      complexTags = [...dom5.queryAll(
          document.ast, dom5.predicates.hasTagName('complex-tag'))];
      assert.equal(complexTags.length, 1);
    });


    test('works for boolean attributes', async () => {
      assert.deepEqual(
          await underliner.underline(document.sourceRangeForAttributeName(
              complexTags[0]!, 'boolean-attr')),
          `
    <complex-tag boolean-attr
                 ~~~~~~~~~~~~`);
    });

    test('works for one line string attributes', async () => {
      assert.deepEqual(
          await underliner.underline(document.sourceRangeForAttributeName(
              complexTags[0]!, 'string-attr')),
          `
                 string-attr="like this"
                 ~~~~~~~~~~~`);
    });

    test('works for multiline string attributes', async () => {
      assert.deepEqual(
          await underliner.underline(document.sourceRangeForAttributeName(
              complexTags[0]!, 'multi-line-attr')),
          `
                 multi-line-attr="
                 ~~~~~~~~~~~~~~~`);
    });
    test(
        'works for attributes with whitespace around the equals sign',
        async () => {
          assert.deepEqual(
              await underliner.underline(document.sourceRangeForAttributeName(
                  complexTags[0]!, 'whitespace-around-equals')),
              `
                whitespace-around-equals
                ~~~~~~~~~~~~~~~~~~~~~~~~`);
        });

    suite('for a void element', () => {
      test('works for a string attribute', async () => {
        const linkTags = [...dom5.queryAll(
            document.ast, dom5.predicates.hasTagName('link'))];
        assert.equal(linkTags.length, 2);

        assert.deepEqual(
            await underliner.underline(
                document.sourceRangeForAttributeName(linkTags[0]!, 'rel')),
            `
    <link rel="has attributes">
          ~~~`);

        assert.deepEqual(
            await underliner.underline(
                document.sourceRangeForAttributeName(linkTags[1]!, 'foo')),
            `
          foo=bar>
          ~~~`);
      });
    });
  });

  suite('sourceRangeForAttributeValue', () => {
    let complexTags: parse5.ASTNode[];
    setup(() => {
      complexTags = [...dom5.queryAll(
          document.ast, dom5.predicates.hasTagName('complex-tag'))];
      assert.equal(complexTags.length, 1);
    });


    test('returns undefined for boolean attributes', async () => {
      assert.deepEqual(
          document.sourceRangeForAttributeValue(
              complexTags[0]!, 'boolean-attr'),
          undefined);
    });

    test('works for one line string attributes', async () => {
      assert.deepEqual(
          await underliner.underline(document.sourceRangeForAttributeValue(
              complexTags[0]!, 'string-attr')),
          `
                 string-attr="like this"
                             ~~~~~~~~~~~`);
    });

    test('works for multiline string attributes', async () => {
      assert.deepEqual(
          await underliner.underline(document.sourceRangeForAttributeValue(
              complexTags[0]!, 'multi-line-attr')),
          `
                 multi-line-attr="
                                 ~
                    can go on
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                    for multiple lines
~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~~
                "
~~~~~~~~~~~~~~~~~`);
    });

    test(
        'works for attributes with whitespace around the equals sign',
        async () => {
          assert.deepEqual(
              await underliner.underline(document.sourceRangeForAttributeValue(
                  complexTags[0]!, 'whitespace-around-equals')),
              `
                "yes this is legal">
                ~~~~~~~~~~~~~~~~~~~`);
        });

    suite('for a void element', () => {
      test('works for a string attribute', async () => {
        const linkTags = [...dom5.queryAll(
            document.ast, dom5.predicates.hasTagName('link'))];
        assert.equal(linkTags.length, 2);

        assert.deepEqual(
            await underliner.underline(
                document.sourceRangeForAttributeValue(linkTags[0]!, 'rel')),
            `
    <link rel="has attributes">
              ~~~~~~~~~~~~~~~~`);

        assert.deepEqual(
            await underliner.underline(
                document.sourceRangeForAttributeValue(linkTags[1]!, 'foo')),
            `
          foo=bar>
              ~~~`);
      });
    });
  });
});
