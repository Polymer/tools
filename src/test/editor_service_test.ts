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

import {invertPromise} from './test-utils';

suite('EditorService', function() {
  const basedir = path.join(__dirname, 'static');
  const indexFile = path.join('editor-service', 'index.html');
  const tagPosition = {line: 7, column: 9};
  const tagPositionEnd = {line: 7, column: 21};
  const localAttributePosition = {line: 7, column: 31};
  const deepAttributePosition = {line: 7, column: 49};
  const elementTypehead = [
    {
      tagname: 'behavior-test-elem',
      description: 'An element to test out behavior inheritance.'
    },
    {description: '', tagname: 'class-declaration'},
    {description: '', tagname: 'anonymous-class'},
    {description: '', tagname: 'class-expression'},
    {
      description: 'This is a description of WithObservedAttributes.',
      tagname: 'vanilla-with-observed-attributes'
    },
    {description: '', tagname: 'register-before-declaration'},
    {description: '', tagname: 'register-before-expression'},
  ];
  const attributeTypeahead = [
    {
      name: 'local-property',
      description: 'A property defined directly on behavior-test-elem.',
      type: 'boolean',
      sortKey: 'aaa-local-property',
    },
    {
      name: 'inherit-please',
      description: 'A property provided by SimpleBehavior.',
      type: 'number',
      sortKey: 'eee-inherit-please',
    },
    {
      name: 'deeply-inherited-property',
      description: 'This is a deeply inherited property.',
      type: 'Array',
      sortKey: 'eee-deeply-inherited-property',
    },
    {
      name: 'on-local-property-changed',
      description: 'Fired when the `localProperty` property changes.',
      type: 'CustomEvent',
      sortKey: 'fff-aaa-on-local-property-changed',
    },
    {
      name: 'on-inherit-please-changed',
      description: 'Fired when the `inheritPlease` property changes.',
      type: 'CustomEvent',
      sortKey: 'fff-eee-on-inherit-please-changed',
    },
    {
      name: 'on-deeply-inherited-property-changed',
      description: 'Fired when the `deeplyInheritedProperty` property changes.',
      type: 'CustomEvent',
      sortKey: 'fff-eee-on-deeply-inherited-property-changed'
    },

  ];

  // The weird cast is because the service will always be non-null.
  let editorService: EditorService = <EditorService><any>null;
  setup(async function() {
    editorService = new EditorService({urlLoader: new FSUrlLoader(basedir)});
  });

  suite('getDocumentationFor', function() {
    const tagDescription = 'An element to test out behavior inheritance.';
    const localAttributeDescription =
        '{boolean} A property defined directly on behavior-test-elem.';
    const deepAttributeDescription =
        '{Array} This is a deeply inherited property.';

    let testName = 'it supports getting the element description ' +
        'when hovering over its tag name';
    test(testName, async function() {
      editorService.fileChanged(indexFile);
      assert.equal(
          await editorService.getDocumentationFor(indexFile, tagPosition),
          tagDescription);
    });
    testName = 'it can still get element info after changing a file in memory';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      const contents = fs.readFileSync(path.join(basedir, indexFile), 'utf-8');
      // Add a newline at the beginning of the file, shifting the lines
      // down.
      editorService.fileChanged(indexFile, `\n${contents}`);

      assert.equal(
          await editorService.getDocumentationFor(indexFile, tagPosition),
          undefined);
      assert.equal(
          await editorService.getDocumentationFor(
              indexFile,
              {line: tagPosition.line + 1, column: tagPosition.column}),
          tagDescription, );
    });
    test(`it can't get element info before reading the file`, async function() {
      assert.equal(
          await editorService.getDocumentationFor(indexFile, tagPosition),
          undefined);
    });
    test('it supports getting an attribute description', async function() {
      editorService.fileChanged(indexFile);
      assert.equal(
          await editorService.getDocumentationFor(
              indexFile, localAttributePosition),
          localAttributeDescription);
    });

    testName = 'it supports getting a description of an attribute ' +
        'defined in a behavior';
    test(testName, async function() {
      editorService.fileChanged(indexFile);
      assert.equal(
          await editorService.getDocumentationFor(
              indexFile, deepAttributePosition),
          deepAttributeDescription);
    });
  });

  suite('getDefinitionFor', function() {
    let testName = `it supports getting the definition of ` +
        `an element from its tag`;
    test(testName, async function() {
      editorService.fileChanged(indexFile);
      assert.deepEqual(
          await editorService.getDefinitionFor(indexFile, tagPosition), {
            file: 'analysis/behaviors/elementdir/element.html',
            line: 4,
            column: 10
          });
    });

    testName = 'it supports getting the definition of a local attribute';
    test(testName, async function() {
      editorService.fileChanged(indexFile);
      assert.deepEqual(
          await editorService.getDefinitionFor(
              indexFile, localAttributePosition),
          {
            file: 'analysis/behaviors/elementdir/element.html',
            line: 9,
            column: 6
          });
    });

    testName = 'it supports getting the definition of an attribute ' +
        'defined in a behavior';
    test(testName, async function() {
      editorService.fileChanged(indexFile);
      assert.deepEqual(
          await editorService.getDefinitionFor(
              indexFile, deepAttributePosition),
          {
            line: 5,
            column: 6,
            file: 'analysis/behaviors/subdir/subbehavior.html'
          });
    });

  });

  suite('getTypeaheadCompletionsFor', function() {
    let testName = 'Get element completions for a start tag.';
    test(testName, async function() {
      editorService.fileChanged(indexFile);
      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, tagPosition),
          {kind: 'element-tags', elements: elementTypehead});
    });

    testName = 'Gets element completions with an incomplete tag';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      const incompleteText = `<behav>`;
      editorService.fileChanged(indexFile, incompleteText);
      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, {line: 0, column: incompleteText.length - 2}),
          {kind: 'element-tags', elements: elementTypehead});
    });

    test('get element completions for the end of a tag', async function() {
      editorService.fileChanged(indexFile);
      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, tagPositionEnd),
          {kind: 'element-tags', elements: elementTypehead});
    });

    testName = 'Get attribute completions when editing an existing attribute';
    test(testName, async function() {
      editorService.fileChanged(indexFile);
      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, localAttributePosition),
          {kind: 'attributes', attributes: attributeTypeahead});
    });

    testName = 'Get attribute completions when adding a new attribute';
    test(testName, async function() {
      await editorService.fileChanged(indexFile);
      const partialContents = [
        `<behavior-test-elem >`, `<behavior-test-elem existing-attr>`,
        `<behavior-test-elem existing-attr></behavior-test-elem>`,
        `<behavior-test-elem existing-attr></wrong-closing-tag>`
      ];
      for (const partial of partialContents) {
        editorService.fileChanged(indexFile, partial);
        assert.deepEqual(
            await editorService.getTypeaheadCompletionsFor(indexFile, {
              line: 0,
              column: 20 /* after the space after the element name */
            }),
            {kind: 'attributes', attributes: attributeTypeahead});
      }
    });

    testName = 'Recover from references to undefined files.';
    test(testName, async function() {
      const goodContents =
          fs.readFileSync(path.join(basedir, indexFile), 'utf-8');
      await editorService.fileChanged(indexFile);

      // Load a file that contains a reference error.
      await editorService.fileChanged(indexFile, `${goodContents}
           <script src="nonexistant.js"></script>`);

      // We recover after getting a good version of the file.
      await editorService.fileChanged(indexFile);

      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, localAttributePosition),
          {kind: 'attributes', attributes: attributeTypeahead});
    });

    testName = 'Remain useful in the face of unloadable files.';
    test(testName, async function() {
      const goodContents =
          fs.readFileSync(path.join(basedir, indexFile), 'utf-8');
      await editorService.fileChanged(indexFile);

      // We load a file that contains a reference error.
      await editorService.fileChanged(indexFile, `${goodContents}
           <script src="nonexistant.js"></script>`);

      // Harder: can we give typeahead completion when there's errors?'
      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, localAttributePosition),
          {kind: 'attributes', attributes: attributeTypeahead});
    });

    testName = 'Remain useful in the face of syntax errors.';
    test(testName, async function() {
      const goodContents =
          fs.readFileSync(path.join(basedir, indexFile), 'utf-8');
      // Load a file with a syntax error
      await invertPromise(editorService.fileChanged(
          path.join(basedir, 'syntax-error.js'),
          'var var var var var var var var “hello”'));

      await editorService.fileChanged(indexFile, `${goodContents}
          <script src="./syntax-error.js"></script>`);
      // Even with a reference to the bad file we can still get completions!
      assert.deepEqual(
          await editorService.getTypeaheadCompletionsFor(
              indexFile, localAttributePosition),
          {kind: 'attributes', attributes: attributeTypeahead});
    });
  });
});
