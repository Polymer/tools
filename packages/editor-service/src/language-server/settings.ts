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

import {Analyzer} from 'polymer-analyzer';
import {ProjectConfig} from 'polymer-project-config';
import {Diagnostic, DiagnosticSeverity, IConnection} from 'vscode-languageserver';

import FileSynchronizer from './file-synchronizer';
import {AutoDisposable, Change, EventStream} from './util';

export interface SettingsJson {
  readonly analyzeWholePackage: boolean;
  readonly fixOnSave: boolean;
  readonly referencesCodeLens: boolean;
  readonly logToClient: boolean;
  readonly logToFile: string|undefined;
}

// The type we expect from DidChangeConfigurationParams#settings
interface SettingsWrapper {
  'polymer-ide'?: Partial<SettingsJson>;
}

export interface SettingsChangedHandler {
  (latest: SettingsJson, previous: SettingsJson): void;
}

export interface ProjectConfigInfo {
  projectConfig: ProjectConfig;
  diagnostic: Diagnostic|null;
}

export default class Settings extends AutoDisposable {
  static readonly defaults: SettingsJson = {
    analyzeWholePackage: false,
    fixOnSave: false,
    referencesCodeLens: false,
    logToClient: false,
    logToFile: undefined,
  };
  private latest = {...Settings.defaults};
  private readonly fileSynchronizer: FileSynchronizer;
  readonly changeStream: EventStream<Change<SettingsJson>>;
  projectConfig: ProjectConfig = new ProjectConfig({});
  projectConfigDiagnostic: Diagnostic|null = null;
  readonly projectConfigChangeStream: EventStream<Change<ProjectConfigInfo>>;
  private readonly fireProjectConfigChange:
      (change: Change<ProjectConfigInfo>) => void;
  /**
   * A promise that resolves once the initial configuration has probably been
   * received from the client.
   *
   * There's no way to know for certain though, because it's asynchronous, so
   * after a timeout this will resolve either way.
   */
  readonly ready: Promise<void>;
  constructor(
      connection: IConnection, fileSynchronizer: FileSynchronizer,
      private readonly analyzer: Analyzer) {
    super();
    const {fire, stream} = EventStream.create<Change<SettingsJson>>();
    this.changeStream = stream;
    let resolveReady: () => void;
    this.ready = new Promise((resolve) => resolveReady = resolve);
    setTimeout(resolveReady!, 1000);
    connection.onDidChangeConfiguration((change) => {
      resolveReady();
      const settingsWrapper = <SettingsWrapper|undefined>change.settings;
      const settings = settingsWrapper ? settingsWrapper['polymer-ide'] : {};
      const previous = this.latest;
      this.latest = {...Settings.defaults, ...settings};
      fire({newer: this.latest, older: previous});
    });
    this.fileSynchronizer = fileSynchronizer;

    this.disposables.push(
        this.fileSynchronizer.fileChanges.listen((changes) => {
          const polymerJsonUri = analyzer.resolveUrl('polymer.json');
          for (const change of changes) {
            if (change.uri === polymerJsonUri) {
              this.updateProjectConfig();
            }
          }
        }));
    this.updateProjectConfig();

    const {fire: firePcc, stream: pccStream} =
        EventStream.create<Change<ProjectConfigInfo>>();
    this.projectConfigChangeStream = pccStream;
    this.fireProjectConfigChange = firePcc;
  }

  private async updateProjectConfig() {
    // If the file isn't there or isn't readable or whatever, just use an
    // empty object, it's fine.
    let jsonContent = '{}';
    try {
      const url = this.analyzer.resolveUrl('polymer.json');
      if (url !== undefined) {
        jsonContent = await this.fileSynchronizer.urlLoader.load(url);
      }
    } catch {
      // Fall back to empty object.
    }

    let projectConfig;
    let diagnostic: null|Diagnostic = null;
    try {
      const projectConfigJson = JSON.parse(jsonContent);
      projectConfig = ProjectConfig.validateAndCreate(projectConfigJson);
    } catch (e) {
      // TODO: do something with this error. If we had good support for
      //   json documents in the analyzer we could construct a Warning.
      diagnostic = {
        code: 'bad-polymer-json',
        message: `Invalid polymer.json file: ${e && e.message || '' + e}`,
        severity: DiagnosticSeverity.Error,
        source: 'polymer-ide',
        range: {start: {character: 0, line: 0}, end: {character: 0, line: 0}}
      };
      projectConfig = new ProjectConfig({});
    }
    const older = {
      diagnostic: this.projectConfigDiagnostic,
      projectConfig: this.projectConfig
    };
    const newer = {diagnostic, projectConfig};
    this.projectConfig = projectConfig;
    this.projectConfigDiagnostic = diagnostic;
    this.fireProjectConfigChange({older, newer});
  }

  get analyzeWholePackage() {
    return this.latest.analyzeWholePackage;
  }

  get fixOnSave() {
    return this.latest.fixOnSave;
  }

  get referencesCodeLens() {
    return this.latest.referencesCodeLens;
  }

  get logToClient() {
    return this.latest.logToClient;
  }

  get logToFile() {
    return this.latest.logToFile;
  }
}
