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

import {Analyzer} from '../analyzer';
import {EditorService} from '../editor-service';
import {SourceLocation} from '../elements-format';
import {FSUrlLoader} from '../url-loader/fs-url-loader';

suite('EditorService', function() {
  const basedir = path.join(__dirname, 'static', 'analysis', 'behaviors');
  const tagPosition = {line: 6, column: 9};
  const tagPositionEnd = {line: 6, column: 21};
  const localAttributePosition = {line: 6, column: 31};
  const deepAttributePosition = {line: 6, column: 49};


  // The weird cast is because the service will always be non-null.
  let editorService: EditorService = <EditorService><any>null;
  setup(async function() {
    editorService =
        new EditorService(new Analyzer({urlLoader: new FSUrlLoader(basedir)}));
  });

  suite('getDocumentationFor', function() {
    const tagDescription = 'An element to test out behavior inheritance.';
    const localAttributeDescription =
        'A property defined directly on behavior-test-elem.';
    const deepAttributeDescription = 'This is a deeply inherited property.';

    let testName = 'it supports getting the element description ' +
        'when hovering over its tag name';
    test(testName, async function() {
      editorService.fileChanged('index.html');
      assert.equal(
          await editorService.getDocumentationFor('index.html', tagPosition),
          tagDescription);
    });
    testName = 'it can still get element info after changing a file in memory';
    test(testName, async function() {
      await editorService.fileChanged('index.html');
      const contents = fs.readFileSync(path.join(basedir, 'index.html'));
      // Add a newline at the beginning of the file, shifting the lines down.
      editorService.fileChanged('index.html', `\n${contents}`);

      assert.equal(
          await editorService.getDocumentationFor('index.html', tagPosition),
          undefined);
      assert.equal(
          await editorService.getDocumentationFor(
              'index.html',
              {line: tagPosition.line + 1, column: tagPosition.column}),
          tagDescription, );
    });
    test(`it can't get element info before reading the file`, async function() {
      assert.equal(
          await editorService.getDocumentationFor('index.html', tagPosition),
          undefined);
    });
    test('it supports getting an attribute description', async function() {
      editorService.fileChanged('index.html');
      assert.equal(
          await editorService.getDocumentationFor(
              'index.html', localAttributePosition),
          localAttributeDescription);
    });

    // After we move behavior inlining to .resolve() should be able to unskip
    // this
    testName =
        'it supports getting a description of an attribute defined in a behavior';
    test.skip(testName, async function() {
      editorService.fileChanged('index.html');
      assert.equal(
          await editorService.getDocumentationFor(
              'index.html', deepAttributePosition),
          deepAttributeDescription);
    });
  });

  suite('getDefinitionFor', function() {
    let testName = `it supports getting the definition of ` +
        `an element from its tag`;
    test(testName, async function() {
      editorService.fileChanged('index.html');
      assert.deepEqual(
          await editorService.getDefinitionFor('index.html', tagPosition),
          {file: 'elementdir/element.html', line: 4, column: 10});
    });

    testName = 'it supports getting the definition of a local attribute';
    test(testName, async function() {
      editorService.fileChanged('index.html');
      assert.deepEqual(
          await editorService.getDefinitionFor(
              'index.html', localAttributePosition),
          {file: 'elementdir/element.html', line: 9, column: 6});
    });

    // After we move behavior inlining to .resolve() should be able to unskip
    // this
    testName =
        'it supports getting the definition of an attribute defined in a behavior';
    test.skip(testName, async function() {
      editorService.fileChanged('index.html');
      assert.deepEqual(
          await editorService.getDefinitionFor(
              'index.html', deepAttributePosition),
          {line: 5, column: 6, file: '../subdir/subbehavior.html'});
    });

  });

  suite('getTypeaheadCompletionsFor', function() {
    let testName = 'Get element completions for a start tag.';
    test(testName, async function() {
      editorService.fileChanged('index.html');
      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              'index.html', tagPosition),
          {
            kind: 'element-tags',
            elements: [{
              tagname: 'behavior-test-elem',
              description: 'An element to test out behavior inheritance.'
            }]
          });
    });

    testName = 'Gets element completions with an incomplete tag';
    test(testName, async function() {
      await editorService.fileChanged('index.html');
      const incompleteText = `<behav>`;
      editorService.fileChanged('index.html', incompleteText);
      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              'index.html', {line: 0, column: incompleteText.length - 2}),
          {
            kind: 'element-tags',
            elements: [{
              tagname: 'behavior-test-elem',
              description: 'An element to test out behavior inheritance.'
            }]
          });
    });

    test('get element completions for the end of a tag', async function() {
      editorService.fileChanged('index.html');
      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              'index.html', tagPositionEnd),
          {
            kind: 'element-tags',
            elements: [{
              tagname: 'behavior-test-elem',
              description: 'An element to test out behavior inheritance.'
            }]
          });
    });

    testName = 'Get attribute completions when editing an existing attribute';
    test(testName, async function() {
      editorService.fileChanged('index.html');
      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              'index.html', localAttributePosition),
          {
            kind: 'attributes',
            attributes: [{
              name: 'local-property',
              description: 'A property defined directly on behavior-test-elem.'
            }]
          });
    });

    testName = 'Get attribute completions when adding a new attribute';
    test(testName, async function() {
      await editorService.fileChanged('index.html');
      const partialContents = [
        `<behavior-test-elem >`, `<behavior-test-elem existing-attr>`,
        `<behavior-test-elem existing-attr></behavior-test-elem>`,
        `<behavior-test-elem existing-attr></wrong-closing-tag>`
      ];
      for (const partial of partialContents) {
        editorService.fileChanged('index.html', partial);
        assert.deepEqual(
            await editorService.getTypeaheadCompletionsFor('index.html', {
              line: 0,
              column: 20 /* after the space after the element name */
            }),
            {
              kind: 'attributes',
              attributes: [{
                name: 'local-property',
                description:
                    'A property defined directly on behavior-test-elem.'
              }]
            });
      }

    });
  });
});
