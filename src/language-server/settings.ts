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

import {ResolvedUrl} from 'polymer-analyzer/lib/model/url';
import {ProjectConfig} from 'polymer-project-config';
import {Diagnostic, DiagnosticSeverity, IConnection} from 'vscode-languageserver';

import AnalyzerLSPConverter from './converter';
import FileSynchronizer from './file-synchronizer';
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

export interface ProjectConfigInfo {
  projectConfig: ProjectConfig;
  diagnostic: Diagnostic|null;
}

export default class Settings extends AutoDisposable {
  static readonly defaults:
      SettingsJson = {analyzeWholePackage: false, fixOnSave: false};
  private latest = {...Settings.defaults};
  private readonly fileSynchronizer: FileSynchronizer;
  readonly changeStream: EventStream<Change<SettingsJson>>;
  projectConfig: ProjectConfig = new ProjectConfig({});
  projectConfigDiagnostic: Diagnostic|null = null;
  readonly projectConfigChangeStream: EventStream<Change<ProjectConfigInfo>>;
  private readonly fireProjectConfigChange:
      (change: Change<ProjectConfigInfo>) => void;
  constructor(
      connection: IConnection, fileSynchronizer: FileSynchronizer,
      converter: AnalyzerLSPConverter) {
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
    this.fileSynchronizer = fileSynchronizer;

    this._disposables.push(
        this.fileSynchronizer.fileChanges.listen((changes) => {
          for (const change of changes) {
            const workspacePath = converter.getWorkspacePathToFile(change);
            if (workspacePath === 'polymer.json') {
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
    let jsonContent;
    try {
      jsonContent = await this.fileSynchronizer.urlLoader.load(
          'polymer.json' as ResolvedUrl);
    } catch (e) {
      // If the file isn't there or isn't readable or whatever, just use an
      // empty object, it's fine.
      jsonContent = '{}';
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
}
