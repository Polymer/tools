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
import {mkdirSync, rmdirSync, unlinkSync, writeFileSync} from 'fs';
import * as path from 'path';
import {FileChangeType} from 'vscode-languageserver/lib/main';

import {createTestEnvironment} from './util';

// Tests for some subtler interactions with file synchronization.
// There's otherwise pretty good coverage of this stuff in the other tests.

suite('AnalyzerSynchronizer', function() {

  test('When files are created and deleted we notice', async() => {
    const {client, baseDir} = await createTestEnvironment();
    await client.openFile('foo.html', `<link rel="import" href="./bar.html">`);
    assert.deepEqual(
        (await client.getNextDiagnostics('foo.html')).map(d => d.code),
        ['could-not-load']);
    writeFileSync(path.join(baseDir, 'bar.html'), '', 'utf-8');
    await client.watchedFilesChanged(
        [{path: 'bar.html', type: FileChangeType.Created}]);
    assert.deepEqual(
        (await client.getNextDiagnostics('foo.html')).map(d => d.code), []);

    unlinkSync(path.join(baseDir, 'bar.html'));
    await client.watchedFilesChanged(
        [{path: 'bar.html', type: FileChangeType.Deleted}]);
    assert.deepEqual(
        (await client.getNextDiagnostics('foo.html')).map(d => d.code),
        ['could-not-load']);
    await client.cleanup();
  });

  test('When directories are created and deleted we notice', async() => {
    const {client, baseDir} = await createTestEnvironment();
    await client.openFile(
        'foo.html', `<link rel="import" href="./dir/bar.html">`);
    assert.deepEqual(
        (await client.getNextDiagnostics('foo.html')).map(d => d.code),
        ['could-not-load']);
    mkdirSync(path.join(baseDir, 'dir'));
    writeFileSync(path.join(baseDir, 'dir', 'bar.html'), '', 'utf-8');
    await client.watchedFilesChanged(
        [{path: 'dir/bar.html', type: FileChangeType.Created}]);
    assert.deepEqual(
        (await client.getNextDiagnostics('foo.html')).map(d => d.code), []);

    unlinkSync(path.join(baseDir, 'dir', 'bar.html'));
    rmdirSync(path.join(baseDir, 'dir'));
    // Note that we only mention the directory, not the file.
    await client.watchedFilesChanged(
        [{path: 'dir', type: FileChangeType.Deleted}]);
    assert.deepEqual(
        (await client.getNextDiagnostics('foo.html')).map(d => d.code),
        ['could-not-load']);
    await client.cleanup();
  });
});
