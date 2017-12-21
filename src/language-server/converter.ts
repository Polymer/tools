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
import {Edit, PackageRelativeUrl, ResolvedUrl, Severity, SourcePosition, SourceRange, UrlResolver, Warning} from 'polymer-analyzer';
import {Diagnostic, DiagnosticSeverity, Location, Position as LSPosition, Range as LSRange, TextEdit, WorkspaceEdit} from 'vscode-languageserver';
import Uri from 'vscode-uri';

/**
 * Converts between Analyzer and Editor Service types and LSP types.
 */
export default class AnalyzerLSPConverter {
  constructor(
      private readonly workspaceUri: Uri,
      private readonly urlResolver: UrlResolver) {
  }

  getWorkspacePathToFile(document: {uri: string}): string {
    // TODO(rictic): if this isn't a file uri we should return undefined here.
    return path.relative(
        this.workspaceUri.fsPath, Uri.parse(document.uri).fsPath);
  }

  getAnalyzerUrl(document: {uri: string}): ResolvedUrl|undefined {
    return this.urlResolver.resolve(document.uri as PackageRelativeUrl);
  }

  getUriForLocalPath(localPath: string): string {
    const workspacePath = this.workspaceUri.fsPath;
    const absolutePath = path.join(workspacePath, localPath);
    return Uri.file(absolutePath).toString();
  }

  convertWarningToDiagnostic(warning: Warning): Diagnostic {
    return {
      code: warning.code,
      message: warning.message,
      range: this.convertPRangeToL(warning.sourceRange),
      source: 'polymer-ide',
      severity: this.convertSeverity(warning.severity),
    };
  }

  convertPosition({line, character: column}: LSPosition): SourcePosition {
    return {line, column};
  }

  convertSourcePosition({line, column: character}: SourcePosition): LSPosition {
    return {line, character};
  }

  convertPRangeToL({start, end}: SourceRange): LSRange {
    return {
      start: {line: start.line, character: start.column},
      end: {line: end.line, character: end.column}
    };
  }

  convertLRangeToP({start, end}: LSRange, document: {uri: string}): SourceRange
      |undefined {
    const file = this.getAnalyzerUrl(document);
    if (file === undefined) {
      return undefined;
    }
    return {
      start: {line: start.line, column: start.character},
      end: {line: end.line, column: end.character}, file,
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

  editToWorkspaceEdit(fix: Edit): WorkspaceEdit {
    return this.editsToWorkspaceEdit([fix]);
  }

  editsToWorkspaceEdit(edits: Iterable<Edit>): WorkspaceEdit {
    const edit: WorkspaceEdit = {changes: {}};
    const changes = edit.changes!;
    for (const polymerEdit of edits) {
      for (const replacement of polymerEdit) {
        const uri = replacement.range.file;
        if (!changes[uri]) {
          changes[uri] = [];
        }
        changes[uri]!.push(TextEdit.replace(
            this.convertPRangeToL(replacement.range),
            replacement.replacementText));
      }
    }
    return edit;
  }

  getLocation(sourceRange: SourceRange): Location {
    return {uri: sourceRange.file, range: this.convertPRangeToL(sourceRange)};
  }
}
