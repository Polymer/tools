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
import * as path from 'path';
import {ResolvedUrl} from 'polymer-analyzer/lib/model/url';
import {Diagnostic} from 'vscode-languageserver-types/lib/main';
import {DiagnosticSeverity} from 'vscode-languageserver/lib/main';

import {assertDoesNotSettle, createTestEnvironment} from './util';

const fixtureDir = path.join(__dirname, '..', '..', 'src', 'test', 'static');

suite('DiagnosticGenerator', function() {
  const indexPath = path.join('editor-service', 'index.html') as ResolvedUrl;

  test('For a good document we get no warnings', async() => {
    const {client} = await createTestEnvironment(fixtureDir);
    await client.openFile(indexPath);
    assert.deepEqual(await client.getNextDiagnostics(indexPath), []);
  });

  test(`Warn on imports of files that aren't found.`, async() => {
    const {client, server, underliner} =
        await createTestEnvironment(fixtureDir);

    const indexContents =
        await server.fileSynchronizer.urlLoader.load(indexPath);
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
  });

  test(`Warn on imports of files that don't parse.`, async() => {
    const {client, server, underliner} =
        await createTestEnvironment(fixtureDir);

    const indexContents =
        await server.fileSynchronizer.urlLoader.load(indexPath);
    const badImport = `<script src="../js-parse-error.js"></script>`;
    const fileContents = `${badImport}\n\n${indexContents}`;
    await client.openFile(indexPath, fileContents);
    const diagnostics = await client.getNextDiagnostics(indexPath);
    assert.containSubset(diagnostics, <Diagnostic[]>[{
                           code: 'could-not-load',
                           message: 'Unable to load import: Unexpected token ,',
                           severity: DiagnosticSeverity.Error,
                         }]);

    assert.deepEqual(
        await underliner.underlineDiagnostics(diagnostics, indexPath), [`
<script src="../js-parse-error.js"></script>
            ~~~~~~~~~~~~~~~~~~~~~~`]);
  });

  test(`Warn on syntax errors in inline javascript documents`, async() => {
    const {client, underliner} = await createTestEnvironment(fixtureDir);

    const badScript = `\n<script>var var var var var let const;</script>`;
    await client.openFile(indexPath, badScript);
    const diagnostics = await client.getNextDiagnostics(indexPath);
    assert.containSubset(diagnostics, <Diagnostic[]>[{
                           code: 'parse-error',
                           severity: DiagnosticSeverity.Error,
                           message: `Unexpected keyword 'var'`,
                         }]);
    assert.deepEqual(
        await underliner.underlineDiagnostics(diagnostics, indexPath), [`
<script>var var var var var let const;</script>
            ~`]);
  });

  let testName = `Do not warn on a sibling import ` +
      `if configured with a package url resolver`;
  test(testName, async() => {
    const testBaseDir = path.join(fixtureDir, 'package-url-resolver');
    const {client} = await createTestEnvironment(testBaseDir);
    await client.openFile('simple-elem.html');
    // No warnings:
    assert.deepEqual(await client.getNextDiagnostics('simple-elem.html'), []);
  });

  testName = `Warn about parse errors in the file ` +
      `we're requesting errors for.`;
  test(testName, async() => {
    const {client} = await createTestEnvironment(fixtureDir);
    const path = 'js-parse-error.js';
    await client.openFile(path);
    const diagnostics = await client.getNextDiagnostics(path);
    assert.containSubset(diagnostics, [{
                           code: 'parse-error',
                           message: 'Unexpected token ,',
                           severity: DiagnosticSeverity.Error,
                         }]);
  });

  test('changes in dependencies update cross-file warnings', async() => {
    // This is a regression test of a tricky bug that turned out to be in
    // the analyzer, but this is useful to assert that it still works.
    const {client} = await createTestEnvironment(fixtureDir);
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
  });

  // TODO(rictic): add tests for analyzeWholePackage here
  // TODO(rictic): add tests for code actions here
  // TODO(rictic): add tests for fix on save here
  // TODO(rictic): add tests for apply all fixes somewhere
});
