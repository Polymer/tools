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

import * as path from 'path';
import {Severity, SourcePosition, SourceRange} from 'polymer-analyzer';
import {Diagnostic, DiagnosticSeverity, Position as LSPosition, Range as LSRange} from 'vscode-languageserver';
import Uri from 'vscode-uri';
import {Warning} from '../editor-service';

/**
 * Converts between Analyzer and Editor Service types and LSP types.
 */
export default class AnalyzerLSPConverter {
  private readonly _workspaceUri: Uri;
  constructor(workspaceUri: Uri) {
    this._workspaceUri = workspaceUri;
  }

  getWorkspacePathToFile(document: {uri: string}): string {
    return path.relative(
        this._workspaceUri.fsPath, Uri.parse(document.uri).fsPath);
  }

  getUriForLocalPath(localPath: string): string {
    const workspacePath = this._workspaceUri.fsPath;
    const absolutePath = path.join(workspacePath, localPath);
    return Uri.file(absolutePath).toString();
  }

  convertWarningToDiagnostic(warning: Warning): Diagnostic {
    return {
      code: warning.code,
      message: warning.message,
      range: this.convertRange(warning.sourceRange),
      source: 'polymer-ide',
      severity: this.convertSeverity(warning.severity),
    };
  }

  convertPosition({line, character: column}: LSPosition): SourcePosition {
    return {line, column};
  }

  convertRange({start, end}: SourceRange): LSRange {
    return {
      start: {line: start.line, character: start.column},
      end: {line: end.line, character: end.column}
    };
  }

  convertSeverity(severity: Severity): DiagnosticSeverity {
    switch (severity) {
      case Severity.ERROR:
        return DiagnosticSeverity.Error;
      case Severity.WARNING:
        return DiagnosticSeverity.Warning;
      case Severity.INFO:
        return DiagnosticSeverity.Information;
      default:
        throw new Error(
            `This should never happen. Got a severity of ${severity}`);
    }
  }
}
