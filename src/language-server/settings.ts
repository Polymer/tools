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

import {IConnection} from 'vscode-languageserver';

import {AutoDisposable, Change, EventStream} from './util';


export interface SettingsJson {
  readonly analyzeWholePackage: boolean;
  readonly fixOnSave: boolean;
}

// The type we expect from DidChangeConfigurationParams#settings
interface SettingsWrapper {
  'polymer-ide'?: Partial<SettingsJson>;
}

export interface SettingsChangedHandler {
  (latest: SettingsJson, previous: SettingsJson): void;
}

export default class Settings extends AutoDisposable {
  static readonly defaults:
      SettingsJson = {analyzeWholePackage: false, fixOnSave: false};
  private latest = {...Settings.defaults};
  changeStream: EventStream<Change<SettingsJson>>;
  constructor(connection: IConnection) {
    super();
    const {fire, stream} = EventStream.create<Change<SettingsJson>>();
    this.changeStream = stream;
    connection.onDidChangeConfiguration((change) => {
      const settingsWrapper = <SettingsWrapper|undefined>change.settings;
      const settings = settingsWrapper ? settingsWrapper['polymer-ide'] : {};
      const previous = this.latest;
      this.latest = {...Settings.defaults, ...settings};
      fire({newer: this.latest, older: previous});
    });
  }

  get analyzeWholePackage() {
    return this.latest.analyzeWholePackage;
  }

  get fixOnSave() {
    return this.latest.fixOnSave;
  }
}
