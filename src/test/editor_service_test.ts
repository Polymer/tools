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
import {FSUrlLoader} from '../url-loader/fs-url-loader';

suite('EditorService', function() {
  const basedir = path.join(__dirname, 'static', 'analysis', 'behaviors');
  const tagPosition = {line: 6, column: 9};
  const tagDescription = 'An element to test out behavior inheritance.';
  const localAttributePosition = {line: 6, column: 31};
  const localAttributeDescription =
      'A property defined directly on behavior-test-elem.';
  const deepAttributePosition = {line: 6, column: 49};
  const deepAttributeDescription = 'This is a deeply inherited property.';

  // The weird cast is because the service will always be non-null.
  let editorService: EditorService = <EditorService><any>null;
  setup(async function() {
    editorService =
        new EditorService(new Analyzer({urlLoader: new FSUrlLoader(basedir)}));
  });


  let name = 'it supports getting the element description ' +
      'when hovering over its tag name';
  test(name, async function() {
    editorService.fileChanged('index.html');
    assert.equal(
        await editorService.getHoverInfo('index.html', tagPosition),
        tagDescription);
  });
  name = 'it can still get element info after changing a file in memory';
  test(name, async function() {
    await editorService.fileChanged('index.html');
    const contents = fs.readFileSync(path.join(basedir, 'index.html'));
    // Add a newline at the beginning of the file, shifting the lines down.
    editorService.fileChanged('index.html', `\n${contents}`);

    assert.equal(
        await editorService.getHoverInfo('index.html', tagPosition), undefined);
    assert.equal(
        await editorService.getHoverInfo(
            'index.html',
            {line: tagPosition.line + 1, column: tagPosition.column}),
        tagDescription, );
  });
  test(`it can't get element info before reading the file`, async function() {
    assert.equal(
        await editorService.getHoverInfo('index.html', tagPosition), undefined);
  });
  test('it supports getting an attribute description', async function() {
    editorService.fileChanged('index.html');
    assert.equal(
        await editorService.getHoverInfo('index.html', localAttributePosition),
        localAttributeDescription);
  });

  // After we move behavior inlining to .resolve() should be able to unskip this
  name =
      'it supports getting a description of an attribute defined in a behavior';
  test.skip(name, async function() {
    editorService.fileChanged('index.html');
    assert.equal(
        await editorService.getHoverInfo('index.html', deepAttributePosition),
        deepAttributeDescription);
  });
});
