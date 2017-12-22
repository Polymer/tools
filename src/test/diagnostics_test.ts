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

import {assert, use} from 'chai';
import {writeFileSync} from 'fs';
import * as path from 'path';
import {Diagnostic} from 'vscode-languageserver-types/lib/main';
import {DiagnosticSeverity, FileChangeType} from 'vscode-languageserver/lib/main';

import {assertDoesNotSettle, createTestEnvironment} from './util';

use(require('chai-subset'));

const fixtureDir = path.join(__dirname, '..', '..', 'src', 'test', 'static');

suite('DiagnosticGenerator', function() {
  const indexPath = path.join('editor-service', 'index.html');

  test('For a good document we get no warnings', async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    await client.openFile(indexPath);
    assert.deepEqual(await client.getNextDiagnostics(indexPath), []);
    await client.cleanup();
  });

  test(`Warn on imports of files that aren't found.`, async() => {
    const {client, server, underliner} =
        await createTestEnvironment({fixtureDir});

    const indexContents = await server.fileSynchronizer.urlLoader.load(
        client.converter.getAnalyzerUrl({uri: indexPath})!);
    const badImport = `<link rel="import" href="./does-not-exist.html">`;
    const badContents = `${badImport}\n\n${indexContents}`;
    await client.openFile(indexPath, badContents);
    let diagnostics = await client.getNextDiagnostics(indexPath);
    assert.containSubset(
        diagnostics,
        [{code: 'could-not-load', severity: DiagnosticSeverity.Error}]);
    assert.deepEqual(
        await underliner.underlineDiagnostics(diagnostics, indexPath), [`
<link rel="import" href="./does-not-exist.html">
                        ~~~~~~~~~~~~~~~~~~~~~~~`]);
    assert.match(
        diagnostics[0].message,
        /Unable to load import:.*no such file or directory/);

    // Closing the document without saving clears the diagnostics
    await client.closeFile(indexPath);
    assert.deepEqual(await client.getNextDiagnostics(indexPath), []);

    // No more diagnostics
    await assertDoesNotSettle(client.getNextDiagnostics(indexPath));
    await client.cleanup();
  });

  test(`Warn on imports of files that don't parse.`, async() => {
    const {client, server, underliner} =
        await createTestEnvironment({fixtureDir});

    const indexContents = await server.fileSynchronizer.urlLoader.load(
        client.converter.getAnalyzerUrl({uri: indexPath})!);
    const badImport = `<script src="../js-parse-error.js"></script>`;
    const fileContents = `${badImport}\n\n${indexContents}`;
    await client.openFile(indexPath, fileContents);
    const diagnostics = await client.getNextDiagnostics(indexPath);
    assert.containSubset(
        diagnostics, <Diagnostic[]>[{
          code: 'could-not-load',
          message: 'Unable to load import: Unexpected token (18:8)',
          severity: DiagnosticSeverity.Error,
        }]);

    assert.deepEqual(
        await underliner.underlineDiagnostics(diagnostics, indexPath), [`
<script src="../js-parse-error.js"></script>
            ~~~~~~~~~~~~~~~~~~~~~~`]);
    await client.cleanup();
  });

  test(`Warn on syntax errors in inline javascript documents`, async() => {
    const {client, underliner} = await createTestEnvironment({fixtureDir});

    const badScript = `\n<script>var var var var var let const;</script>`;
    await client.openFile(indexPath, badScript);
    const diagnostics = await client.getNextDiagnostics(indexPath);
    assert.containSubset(diagnostics, <Diagnostic[]>[{
                           code: 'parse-error',
                           severity: DiagnosticSeverity.Error,
                           message: `Unexpected token (1:4)`,
                         }]);
    assert.deepEqual(
        await underliner.underlineDiagnostics(diagnostics, indexPath), [`
<script>var var var var var let const;</script>
            ~`]);
    await client.cleanup();
  });

  let testName = `Do not warn on a sibling import ` +
      `if configured with a package url resolver`;
  test(testName, async() => {
    const testBaseDir = path.join(fixtureDir, 'package-url-resolver');
    const {client} = await createTestEnvironment({fixtureDir: testBaseDir});
    await client.openFile('simple-elem.html');
    // No warnings:
    assert.deepEqual(await client.getNextDiagnostics('simple-elem.html'), []);
    await client.cleanup();
  });

  testName = `Warn about parse errors in the file ` +
      `we're requesting errors for.`;
  test(testName, async() => {
    const {client} = await createTestEnvironment({fixtureDir});
    const path = 'js-parse-error.js';
    await client.openFile(path);
    const diagnostics = await client.getNextDiagnostics(path);
    assert.containSubset(diagnostics, [{
                           code: 'parse-error',
                           message: 'Unexpected token (18:8)',
                           severity: DiagnosticSeverity.Error,
                         }]);

    await client.cleanup();
  });

  test('changes in dependencies update cross-file warnings', async() => {
    // This is a regression test of a tricky bug that turned out to be in
    // the analyzer, but this is useful to assert that it still works.
    const {client} = await createTestEnvironment({fixtureDir});
    const basePath = 'base.js';
    const childPath = 'child.html';
    await client.openFile(basePath, `
        class BaseElement extends HTMLElement {}
        customElements.define('vanilla-elem', BaseElement);
      `);
    assert.deepEqual(await client.getNextDiagnostics(basePath), []);
    await client.openFile(childPath, `
        <script src="./base.js"></script>

        <script>
          class Child extends BaseElement {}
          customElements.define('child-elem', Child);
        </script>
      `);
    assert.deepEqual(await client.getNextDiagnostics(basePath), []);
    assert.deepEqual(await client.getNextDiagnostics(childPath), []);
    await client.changeFile(basePath, `
        class VanEl extends HTMLElement {}
        customElements.define('vanilla-elem', VanEl);
      `);
    assert.deepEqual(await client.getNextDiagnostics(basePath), []);
    assert.containSubset(
        await client.getNextDiagnostics(childPath),
        [{message: 'Unable to resolve superclass BaseElement'}]);

    await client.changeFile(basePath, `
        class BaseElement extends HTMLElement {}
        customElements.define('vanilla-elem', BaseElement);
      `);
    assert.deepEqual(await client.getNextDiagnostics(basePath), []);
    assert.deepEqual(await client.getNextDiagnostics(childPath), []);

    await client.cleanup();
  });

  test('can be configured to filter out some warning codes', async() => {
    const {client} = await createTestEnvironment();

    await client.openFile('index.html', `
      <link rel="import" href="nonexistant.html">
      <script>
        class Foo extends What {};
      </script>
    `);

    assert.deepEqual(
        (await client.getNextDiagnostics('index.html')).map(d => d.code),
        ['could-not-load', 'unknown-superclass']);

    await client.openFile(
        'polymer.json',
        JSON.stringify({lint: {ignoreWarnings: ['could-not-load']}}));

    assert.deepEqual(
        (await client.getNextDiagnostics('index.html')).map(d => d.code),
        ['unknown-superclass']);

    await client.cleanup();
  });

  test('can be configured to filter out some files', async function() {
    const {client} = await createTestEnvironment();

    // Now we can be confident we won't be getting unexpected additional
    // diagnostics from recreating the linter.

    await client.openFile('index.html', `
        <link rel="import" href="nonexistant.html">
        <script>
          class Foo extends What {};
        </script>
      `);

    assert.deepEqual(
        (await client.getNextDiagnostics('index.html')).map(d => d.code),
        ['could-not-load', 'unknown-superclass']);

    await client.openFile(
        'polymer.json',
        JSON.stringify({lint: {filesToIgnore: ['*dex*.html']}}));

    assert.deepEqual(
        (await client.getNextDiagnostics('index.html')).map(d => d.code), []);

    await client.cleanup();
  });

  test('sends diagnostics around polymer.json validation', async() => {
    const {client, baseDir} = await createTestEnvironment();

    writeFileSync(
        path.join(baseDir, 'polymer.json'),
        JSON.stringify({lint: {rules: ['bad']}}), 'utf-8');
    await client.watchedFilesChanged(
        [{path: 'polymer.json', type: FileChangeType.Created}]);
    assert.deepEqual(
        (await client.getNextDiagnostics('polymer.json')).map(d => d.message),
        [`Could not find lint rule with code 'bad'`]);
    await client.openFile(
        'polymer.json', JSON.stringify({lint: {rules: ['polymer-2']}}));
    assert.deepEqual(
        (await client.getNextDiagnostics('polymer.json')).map(d => d.message),
        []);
    await client.changeFile(
        'polymer.json', JSON.stringify({lint: {rules: {}}}));
    // This assertion is a bit roundabout because I have a PR out to improve
    // the warning generated by polymer project config.
    const messages =
        (await client.getNextDiagnostics('polymer.json')).map(d => d.message);
    assert.match(
        messages[0], /Invalid polymer\.json file.*not of.*type.*array/);
    await client.cleanup();
  });

  // TODO(rictic): add tests for analyzeWholePackage here
  // TODO(rictic): add tests for code actions here
  // TODO(rictic): add tests for fix on save here
  // TODO(rictic): add tests for apply all fixes somewhere
});
