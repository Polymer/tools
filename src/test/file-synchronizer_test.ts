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
import * as os from 'os';
import * as path from 'path';
import {ResolvedUrl} from 'polymer-analyzer/lib/model/url';
import {DidChangeTextDocumentNotification, DidChangeTextDocumentParams, DidChangeWatchedFilesNotification, DidChangeWatchedFilesParams, DidCloseTextDocumentNotification, DidCloseTextDocumentParams, DidOpenTextDocumentNotification, DidOpenTextDocumentParams, FileChangeType, TextDocuments} from 'vscode-languageserver';
import URI from 'vscode-uri/lib';

import AnalyzerLSPConverter from '../language-server/converter';
import FileSynchronizer from '../language-server/file-synchronizer';

import {createTestConnections} from './util';

suite('FileSynchronizer', () => {
  function createFileSynchronizer(baseDir?: string, debugging?: boolean) {
    if (baseDir) {
      baseDir = getTempCopy(baseDir);
    } else {
      baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-service-tests'));
    }

    const {serverConnection, clientConnection} =
        createTestConnections(debugging);
    const textDocuments = new TextDocuments();
    textDocuments.listen(serverConnection);
    const converter = new AnalyzerLSPConverter(URI.file(baseDir));
    const synchronizer = new FileSynchronizer(
        serverConnection, textDocuments, baseDir, converter);
    return {synchronizer, serverConnection, clientConnection, baseDir};
  }

  test('reads from the filesystem by default', async() => {
    const {synchronizer, baseDir} = createFileSynchronizer();
    fs.writeFileSync(path.join(baseDir, 'index.html'), 'Hello world.\n');
    assert.deepEqual(
        await synchronizer.urlLoader.load('index.html' as ResolvedUrl),
        'Hello world.\n');
  });

  let testName = 'uses the in-memory version while a file is open';
  test(testName, async() => {
    const {synchronizer, baseDir, clientConnection} = createFileSynchronizer();
    const indexPath = path.join(baseDir, 'index.html');
    const indexUri = URI.file(indexPath).toString();

    // We read the file from disk before it is opened.
    fs.writeFileSync(indexPath, 'Filesystem content');
    assert.deepEqual(
        await synchronizer.urlLoader.load('index.html' as ResolvedUrl),
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
        await synchronizer.urlLoader.load('index.html' as ResolvedUrl),
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
        await synchronizer.urlLoader.load('index.html' as ResolvedUrl),
        'Changed text document content');

    // Close without saving
    let closeParams:
        DidCloseTextDocumentParams = {textDocument: {uri: indexUri}};
    clientConnection.sendNotification(
        DidCloseTextDocumentNotification.type, closeParams);
    change = await synchronizer.fileChanges.next;
    assert.deepEqual(change, [{type: FileChangeType.Changed, uri: indexUri}]);
    assert.deepEqual(
        await synchronizer.urlLoader.load('index.html' as ResolvedUrl),
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

function getTempCopy(fromDir: string) {
  const toDir = fs.mkdtempSync(path.join(os.tmpdir(), path.basename(fromDir)));
  copyDir(fromDir, toDir);
  return toDir;
}

function copyDir(fromDir: string, toDir: string) {
  for (const inner of fs.readdirSync(fromDir)) {
    const fromInner = path.join(fromDir, inner);
    const toInner = path.join(toDir, inner);
    const stat = fs.statSync(fromInner);
    if (stat.isDirectory()) {
      fs.mkdirSync(toInner);
      copyDir(fromInner, toInner);
    } else {
      fs.writeFileSync(toInner, fs.readFileSync(fromInner));
    }
  }
}
