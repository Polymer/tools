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

import * as dom5 from 'dom5/lib/index-next';
import {Analyzer} from '../../core/analyzer';
import {PackageRelativeUrl} from '../../index';
import {InMemoryOverlayUrlLoader} from '../../url-loader/overlay-loader';
import {PackageUrlResolver} from '../../url-loader/package-url-resolver';
import {CodeUnderliner} from '../test-utils';

suite('HtmlTemplateLiteralScanner', () => {
  async function analyzeContents(fileName: string, contents: string) {
    const urlResolver = new PackageUrlResolver();
    const urlLoader = new InMemoryOverlayUrlLoader();
    const url = urlResolver.resolve(fileName as PackageRelativeUrl)!;
    urlLoader.urlContentsMap.set(url, contents);
    const analyzer = new Analyzer({urlResolver, urlLoader});
    const analysis = await analyzer.analyze([url]);
    const result = analysis.getDocument(url);
    if (!result.successful) {
      throw new Error(`Tried to get document for url but failed: ${url}`);
    }
    const underliner = new CodeUnderliner(analyzer);
    return {document: result.value, url, underliner};
  }

  test('works in a super simple case', async () => {
    const {document, url} = await analyzeContents('index.js', `
      html\`<div>Hello world</div>\`
    `);
    const documents = document.getFeatures({kind: 'document'});
    assert.deepEqual(
        [...documents].map((d) => [d.url, d.type, d.isInline]),
        [[url, 'js', false], [url, 'html', true]]);
    const [htmlDocument] = document.getFeatures({kind: 'html-document'});
    assert.deepEqual(
        htmlDocument.parsedDocument.contents, `<div>Hello world</div>`);
  });

  test('can get source ranges for tags in the inline document', async () => {
    const {document, underliner} = await analyzeContents('index.js', `
      html\`<div>Hello world</div>
        \${expression()}
        <div>Another tag</div>
      \`;
    `);
    const [htmlDocument] = document.getFeatures({kind: 'html-document'});
    const elements = [...dom5.queryAll(
        htmlDocument.parsedDocument.ast, dom5.predicates.hasTagName('div'))];

    const ranges = elements.map(
        (el) => htmlDocument.parsedDocument.sourceRangeForStartTag(el));
    assert.deepEqual(await underliner.underline(ranges), [
      `
      html\`<div>Hello world</div>
           ~~~~~`,
      `
        <div>Another tag</div>
        ~~~~~`
    ]);
  });

  let testName = 'can handle nesting of inline documents with html at the root';
  test(testName, async () => {
    const {document, underliner, url} = await analyzeContents('index.html', `
      <script>
        html\`<div>Hello world</div>\`;
      </script>
    `);
    const documents = document.getFeatures({kind: 'document'});
    assert.deepEqual(
        [...documents].map((d) => [d.url, d.type, d.isInline]),
        [[url, 'html', false], [url, 'js', true], [url, 'html', true]]);
    const [, htmlDocument] = document.getFeatures({kind: 'html-document'});
    assert.deepEqual(
        htmlDocument.parsedDocument.contents, `<div>Hello world</div>`);
    const elements = [...dom5.queryAll(
        htmlDocument.parsedDocument.ast, dom5.predicates.hasTagName('div'))];

    const ranges = elements.map(
        (el) => htmlDocument.parsedDocument.sourceRangeForStartTag(el));
    assert.deepEqual(await underliner.underline(ranges), [
      `
        html\`<div>Hello world</div>\`;
             ~~~~~`,
    ]);
  });

  testName = 'can handle nesting of inline documents with js at the root';
  test(testName, async () => {
    const {document, underliner, url} = await analyzeContents('index.js', `

      html\`
        <div>Hello world</div>

        <script>
          \${
            multiLineExpressionToComplicateSourceRanges
          }
          html\\\`
            <style>
              div {
                --working: yes;
              }
            </style>
          \\\`
        </script>
      \`;
    `);
    const documents = document.getFeatures({kind: 'document'});
    assert.deepEqual([...documents].map((d) => [d.url, d.type, d.isInline]), [
      [url, 'js', false],
      [url, 'html', true],
      [url, 'js', true],
      [url, 'html', true],
      [url, 'css', true]
    ]);

    const [customPropertyAssignment] =
        document.getFeatures({kind: 'css-custom-property-assignment'});
    assert.deepEqual(
        await underliner.underline(customPropertyAssignment.sourceRange), `
                --working: yes;
                ~~~~~~~~~`);
  });

  // See: https://github.com/Polymer/polymer-analyzer/issues/818
  testName = 'can handle escape characters properly';
  test.skip(testName, async () => {
    const {document, underliner, url} = await analyzeContents('index.js', `
      html\`\\n\\n<div>Hello world</div>\`;
    `);
    const documents = document.getFeatures({kind: 'document'});
    assert.deepEqual(
        [...documents].map((d) => [d.url, d.type, d.isInline]),
        [[url, 'js', false], [url, 'html', true]]);
    const [htmlDocument] = document.getFeatures({kind: 'html-document'});
    assert.deepEqual(
        htmlDocument.parsedDocument.contents, '\n\n<div>Hello world</div>');
    const elements = [...dom5.queryAll(
        htmlDocument.parsedDocument.ast, dom5.predicates.hasTagName('div'))];
    const ranges = elements.map(
        (el) => htmlDocument.parsedDocument.sourceRangeForStartTag(el));
    assert.deepEqual(await underliner.underline(ranges), [`
      html\`\\n\\n<div>Hello world</div>\`;
                ~~~~~`]);
  });
});
