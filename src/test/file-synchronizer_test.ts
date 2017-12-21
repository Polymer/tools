/**
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
import * as fs from 'fs';
import * as path from 'path';
import {DidChangeTextDocumentNotification, DidChangeTextDocumentParams, DidChangeWatchedFilesNotification, DidChangeWatchedFilesParams, DidCloseTextDocumentNotification, DidCloseTextDocumentParams, DidOpenTextDocumentNotification, DidOpenTextDocumentParams, FileChangeType} from 'vscode-languageserver';
import URI from 'vscode-uri/lib';


import {createFileSynchronizer} from './util';

suite('FileSynchronizer', () => {
  test('reads from the filesystem by default', async() => {
    const {synchronizer, baseDir, converter} = createFileSynchronizer();
    fs.writeFileSync(path.join(baseDir, 'index.html'), 'Hello world.\n');
    assert.deepEqual(
        await synchronizer.urlLoader.load(
            converter.getAnalyzerUrl({uri: 'index.html'})!),
        'Hello world.\n');
  });

  let testName = 'uses the in-memory version while a file is open';
  test(testName, async() => {
    const {synchronizer, baseDir, clientConnection, converter} =
        createFileSynchronizer();
    const indexPath = path.join(baseDir, 'index.html');
    const indexUri = URI.file(indexPath).toString();

    // We read the file from disk before it is opened.
    fs.writeFileSync(indexPath, 'Filesystem content');
    assert.deepEqual(
        await synchronizer.urlLoader.load(
            converter.getAnalyzerUrl({uri: 'index.html'})!),
        'Filesystem content');

    // Open the document
    let openParams: DidOpenTextDocumentParams = {
      textDocument: {
        languageId: 'html',
        text: 'Initial text document content',
        uri: indexUri,
        version: 0
      }
    };
    clientConnection.sendNotification(
        DidOpenTextDocumentNotification.type, openParams);
    let change = await synchronizer.fileChanges.next;
    assert.deepEqual(change, [{type: FileChangeType.Changed, uri: indexUri}]);
    assert.deepEqual(
        await synchronizer.urlLoader.load(
            converter.getAnalyzerUrl({uri: 'index.html'})!),
        'Initial text document content');

    // Change the file in memory
    let changeParams: DidChangeTextDocumentParams = {
      textDocument: {uri: indexUri, version: 1},
      contentChanges: [{
        range: {start: {line: 0, character: 0}, end: {line: 0, character: 100}},
        text: 'Changed text document content'
      }]
    };
    clientConnection.sendNotification(
        DidChangeTextDocumentNotification.type, changeParams);
    change = await synchronizer.fileChanges.next;
    assert.deepEqual(change, [{type: FileChangeType.Changed, uri: indexUri}]);
    assert.deepEqual(
        await synchronizer.urlLoader.load(
            converter.getAnalyzerUrl({uri: 'index.html'})!),
        'Changed text document content');

    // Close without saving
    let closeParams:
        DidCloseTextDocumentParams = {textDocument: {uri: indexUri}};
    clientConnection.sendNotification(
        DidCloseTextDocumentNotification.type, closeParams);
    change = await synchronizer.fileChanges.next;
    assert.deepEqual(change, [{type: FileChangeType.Changed, uri: indexUri}]);
    assert.deepEqual(
        await synchronizer.urlLoader.load(
            converter.getAnalyzerUrl({uri: 'index.html'})!),
        'Filesystem content');
  });

  testName = 'passes along notifications about files changed on disk';
  test(testName, async() => {
    const {synchronizer, baseDir, clientConnection} = createFileSynchronizer();
    const changes = [
      {
        type: FileChangeType.Created as FileChangeType,
        uri: URI.file(path.join(baseDir, 'created.html')).toString()
      },
      {
        type: FileChangeType.Changed as FileChangeType,
        uri: URI.file(path.join(baseDir, 'changed.html')).toString()
      },
      {
        type: FileChangeType.Deleted as FileChangeType,
        uri: URI.file(path.join(baseDir, 'deleted.html')).toString()
      },
    ];
    const filesChangedParams: DidChangeWatchedFilesParams = {changes};
    clientConnection.sendNotification(
        DidChangeWatchedFilesNotification.type, filesChangedParams);
    const receivedChanges = await synchronizer.fileChanges.next;
    assert.deepEqual(receivedChanges, changes);
  });
});
