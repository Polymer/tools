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

import {Analyzer, Warning} from 'polymer-analyzer';
import {Linter, registry, Rule} from 'polymer-linter';
import {Diagnostic, IConnection, TextDocuments} from 'vscode-languageserver';

import AnalyzerLSPConverter from './converter';
import FileSynchronizer from './file-synchronizer';
import Settings from './settings';
import {AutoDisposable} from './util';

/**
 * Publishes diagnostics as files change.
 */
export default class DiagnosticGenerator extends AutoDisposable {
  private linter: Linter;
  constructor(
      private analyzer: Analyzer, private converter: AnalyzerLSPConverter,
      private connection: IConnection, private settings: Settings,
      fileSynchronizer: FileSynchronizer, private documents: TextDocuments) {
    super();

    connection.onDidCloseTextDocument((event) => {
      if (!settings.analyzeWholePackage) {
        // If the user hasn't asked for whole-package analysis then it's
        // annoying to see warnings for files that aren't open, and in any
        // case, we'll never update those diagnostics while the file is closed.
        connection.sendDiagnostics(
            {diagnostics: [], uri: event.textDocument.uri});
      }
    });

    settings.projectConfigChangeStream.listen(() => {
      this.updateLinter();
    });
    this._disposables.push(fileSynchronizer.fileChanges.listen(() => {
      this._reportWarnings();
    }));
    settings.changeStream.listen(({newer, older}) => {
      if (newer.analyzeWholePackage !== older.analyzeWholePackage) {
        // When we switch this setting we want to be sure that we'll clear out
        // warnings that were reported with the old setting but not the new
        // one.
        if (newer.analyzeWholePackage) {
          this._urisReportedWarningsFor = new Set(this.documents.keys());
        } else {
          for (const uri of this._urisReportedWarningsFor) {
            this.connection.sendDiagnostics({uri, diagnostics: []});
          }
        }
        this._reportWarnings();
      }
    });

    this.updateLinter();
  }

  private updateLinter() {
    let rules: Iterable<Rule> = new Set();
    const projectConfig = this.settings.projectConfig;
    if (projectConfig.lint && projectConfig.lint.rules) {
      try {
        rules = registry.getRules(projectConfig.lint.rules);
      } catch (e) {
        // TODO(rictic): let the user know about this error, and about
        //   this.settings.projectConfigDiagnostic if it exists.
      }
    }

    const linter = new Linter(rules, this.analyzer);
    this.linter = linter;
    this._reportWarnings();
  }

  /**
   * Used so that if we don't have any warnings to report for a file on the
   * next go around we can remember to send an empty array.
   */
  private _urisReportedWarningsFor = new Set<string>();
  private async _reportWarnings(): Promise<void> {
    if (this.settings.analyzeWholePackage) {
      const warnings = await this.linter.lintPackage();
      this._reportPackageWarnings(warnings);
    } else {
      const warnings = await this.linter.lint(this.documents.keys().map(
          uri => this.converter.getWorkspacePathToFile({uri})));
      const diagnosticsByUri = new Map<string, Diagnostic[]>();
      for (const warning of warnings) {
        const diagnostic = this.converter.convertWarningToDiagnostic(warning);
        let diagnostics =
            diagnosticsByUri.get(
                this.converter.getUriForLocalPath(warning.sourceRange.file)) ||
            [];
        diagnostics.push(diagnostic);
        diagnosticsByUri.set(
            this.converter.getUriForLocalPath(warning.sourceRange.file),
            diagnostics);
      }

      for (const [uri, diagnostics] of diagnosticsByUri) {
        this.connection.sendDiagnostics({uri, diagnostics});
      }
    }
  }

  /**
   * Report the given warnings for the package implicitly defined by the
   * workspace.
   *
   * This is pulled out into its own non-async function to document and maintain
   * the invariant that there must not be an await between the initial read of
   * _urisReportedWarningsFor and the write of it at the end.
   */
  private _reportPackageWarnings(warnings: Iterable<Warning>) {
    const reportedLastTime = new Set(this._urisReportedWarningsFor);
    this._urisReportedWarningsFor = new Set<string>();
    const diagnosticsByUri = new Map<string, Diagnostic[]>();
    for (const warning of warnings) {
      const uri = this.converter.getUriForLocalPath(warning.sourceRange.file);
      reportedLastTime.delete(uri);
      this._urisReportedWarningsFor.add(uri);
      let diagnostics = diagnosticsByUri.get(uri);
      if (!diagnostics) {
        diagnostics = [];
        diagnosticsByUri.set(uri, diagnostics);
      }
      diagnostics.push(this.converter.convertWarningToDiagnostic(warning));
    }
    for (const [uri, diagnostics] of diagnosticsByUri) {
      this.connection.sendDiagnostics({uri, diagnostics});
    }
    for (const uriWithNoWarnings of reportedLastTime) {
      this.connection.sendDiagnostics(
          {uri: uriWithNoWarnings, diagnostics: []});
    }
    this._urisReportedWarningsFor = new Set(diagnosticsByUri.keys());
  }
}
