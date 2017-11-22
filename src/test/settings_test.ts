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
import {DidChangeConfigurationNotification} from 'vscode-languageserver';

import Settings from '../language-server/settings';
import {createTestConnections} from './util';

suite('Settings', () => {
  function createSettings(debugging?: boolean) {
    const {serverConnection, clientConnection} =
        createTestConnections(debugging);
    const settings = new Settings(serverConnection);
    return {settings, serverConnection, clientConnection};
  }

  test('starts with default values', () => {
    const {settings} = createSettings();
    assert.deepEqual(settings.analyzeWholePackage, false);
    assert.deepEqual(settings.fixOnSave, false);
  });

  test('updates when an update comes in', async() => {
    const {settings, clientConnection} = createSettings();
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
      newer: {fixOnSave: true, analyzeWholePackage: true},
      older: {fixOnSave: false, analyzeWholePackage: false}
    });
    assert.deepEqual(
        {
          analyzeWholePackage: settings.analyzeWholePackage,
          fixOnSave: settings.fixOnSave
        },
        {analyzeWholePackage: true, fixOnSave: true});
  });

  test('missing settings are filled in with defaults.', async() => {
    const {settings, clientConnection} = createSettings();
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
});
