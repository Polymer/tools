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
import * as path from 'path';
import {Analyzer} from 'polymer-analyzer';
import {DidChangeConfigurationNotification, DidOpenTextDocumentNotification, DidOpenTextDocumentParams} from 'vscode-languageserver';
import URI from 'vscode-uri/lib';

import Settings from '../language-server/settings';

import {createFileSynchronizer} from './util';

suite('Settings', () => {
  async function createSettings(debugging?: boolean) {
    const {serverConnection, clientConnection, synchronizer, baseDir} =
        createFileSynchronizer(undefined, debugging);
    const settings = new Settings(
        serverConnection, synchronizer,
        await Analyzer.createForDirectory(baseDir));
    return {settings, serverConnection, clientConnection, baseDir};
  }

  test('starts with default values', async() => {
    const {settings} = await createSettings();
    assert.deepEqual(settings.analyzeWholePackage, false);
    assert.deepEqual(settings.fixOnSave, false);
  });

  test('updates when an update comes in', async() => {
    const {settings, clientConnection} = await createSettings();
    assert.deepEqual(
        {
          analyzeWholePackage: settings.analyzeWholePackage,
          fixOnSave: settings.fixOnSave
        },
        {analyzeWholePackage: false, fixOnSave: false});
    clientConnection.sendNotification(DidChangeConfigurationNotification.type, {
      settings: {'polymer-ide': {fixOnSave: true, analyzeWholePackage: true}}
    });
    const settingsChange = await settings.changeStream.next;
    assert.deepEqual(settingsChange, {
      newer: {
        fixOnSave: true,
        analyzeWholePackage: true,
        referencesCodeLens: false,
        logToClient: false,
        logToFile: undefined
      },
      older: {
        fixOnSave: false,
        analyzeWholePackage: false,
        referencesCodeLens: false,
        logToClient: false,
        logToFile: undefined
      }
    });
    assert.deepEqual(
        {
          analyzeWholePackage: settings.analyzeWholePackage,
          fixOnSave: settings.fixOnSave,
          referencesCodeLens: false,
          logToClient: false,
          logToFile: undefined
        },
        {
          analyzeWholePackage: true,
          fixOnSave: true,
          referencesCodeLens: false,
          logToClient: false,
          logToFile: undefined
        });
  });

  test('missing settings are filled in with defaults.', async() => {
    const {settings, clientConnection} = await createSettings();
    clientConnection.sendNotification(DidChangeConfigurationNotification.type, {
      settings: {'polymer-ide': {fixOnSave: true, analyzeWholePackage: true}}
    });
    await settings.changeStream.next;
    assert.deepEqual(
        {
          analyzeWholePackage: settings.analyzeWholePackage,
          fixOnSave: settings.fixOnSave
        },
        {analyzeWholePackage: true, fixOnSave: true});
    clientConnection.sendNotification(DidChangeConfigurationNotification.type, {
      settings: {
        'polymer-ide':
            {fixOnSave: true, /* no analyzeWholePackage setting */}
      }
    });
    await settings.changeStream.next;
    assert.deepEqual(
        {
          analyzeWholePackage: settings.analyzeWholePackage,
          fixOnSave: settings.fixOnSave
        },
        {analyzeWholePackage: false, fixOnSave: true});
  });

  test('keeps ProjectConfig synchronized', async() => {
    const {settings, clientConnection, baseDir} = await createSettings();
    assert.equal(settings.projectConfig.lint, undefined);
    assert.equal(settings.projectConfigDiagnostic, null);
    await settings.projectConfigChangeStream.next;
    let openedParams: DidOpenTextDocumentParams = {
      textDocument: {
        languageId: 'json',
        text: JSON.stringify({lint: {rules: ['polymer-2']}}),
        version: 1,
        uri: URI.file(path.join(baseDir, 'polymer.json')).toString()
      }
    };
    clientConnection.sendNotification(
        DidOpenTextDocumentNotification.type, openedParams);
    await settings.projectConfigChangeStream.next;
    assert.equal(settings.projectConfigDiagnostic, null);
    assert.deepEqual(settings.projectConfig.lint, {rules: ['polymer-2']});

    openedParams = {
      textDocument: {
        languageId: 'json',
        text: JSON.stringify({lint: {rules: {foo: 'polymer-2'}}}),
        version: 1,
        uri: URI.file(path.join(baseDir, 'polymer.json')).toString()
      }
    };
    clientConnection.sendNotification(
        DidOpenTextDocumentNotification.type, openedParams);
    await settings.projectConfigChangeStream.next;
    assert.deepEqual(settings.projectConfig.lint, undefined);
    assert.equal(
        settings.projectConfigDiagnostic!.message,
        `Invalid polymer.json file: ` +
            `Property 'lint.rules' is not of a type(s) array`);
  });
});
