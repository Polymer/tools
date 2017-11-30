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

import {applyEdits, Edit, isPositionInsideRange, makeParseLoader, PackageUrlResolver, SourceRange, Warning, WarningCarryingException} from 'polymer-analyzer';
import {AnalysisCache} from 'polymer-analyzer/lib/core/analysis-cache';
import {AnalysisContext} from 'polymer-analyzer/lib/core/analysis-context';
import {ResolvedUrl} from 'polymer-analyzer/lib/model/url';
import * as util from 'util';
import {ApplyWorkspaceEditParams, ApplyWorkspaceEditRequest, ApplyWorkspaceEditResponse, ClientCapabilities, CodeActionParams, Command, CompletionItem, CompletionItemKind, CompletionList, Definition, Diagnostic, FileChangeType, FileEvent, Hover, IConnection, InitializeResult, Location, ServerCapabilities, TextDocumentPositionParams, TextDocuments, TextEdit, WillSaveTextDocumentParams, WorkspaceEdit} from 'vscode-languageserver';
import Uri from 'vscode-uri';

import {AttributeCompletion, LocalEditorService} from '../local-editor-service';

import AnalyzerLSPConverter from './converter';
import FileSynchronizer from './file-synchronizer';
import Settings, {SettingsJson} from './settings';
import {AutoDisposable, Change} from './util';


const applyEditCommandName = 'polymer-ide/applyEdit';

const applyAllFixesCommandName: string = 'polymer-ide/applyAllFixes';

export default class LanguageServer extends AutoDisposable {
  readonly converter: AnalyzerLSPConverter;
  private readonly _connection: IConnection;
  private readonly _editorService: LocalEditorService;
  readonly fileSynchronizer: FileSynchronizer;
  private readonly _documents: TextDocuments;

  private _settings: Settings;

  /** Get an initialized and ready language server. */
  static async initializeWithConnection(
      connection: IConnection, interceptLogs = true): Promise<LanguageServer> {
    function getWorkspaceUri(
        rootUri: string|null, rootPath: string|null|undefined): Uri|null {
      if (rootUri) {
        return Uri.parse(rootUri);
      }
      if (rootPath) {
        return Uri.file(rootPath);
      }
      return null;
    }

    function makeServer(workspaceUri: Uri) {
      return new LanguageServer(connection, workspaceUri);
    }

    // When we get an initialization request we want to construct a server and
    // tell the client about its capabilities.
    const server = await new Promise<LanguageServer>((resolve, reject) => {
      connection.onInitialize((params): InitializeResult => {
        // Normalize across the two ways that the workspace may be
        // communicated to us.
        const workspaceUri = getWorkspaceUri(params.rootUri, params.rootPath);
        if (!workspaceUri || workspaceUri.scheme !== 'file') {
          reject(
              `Got invalid workspaceUri from client: ` +
              `${util.inspect(workspaceUri)}`);
          return {capabilities: {}};
        }
        const newServer = makeServer(workspaceUri);
        resolve(newServer);
        return {capabilities: newServer.capabilities(params.capabilities)};
      });
    });

    // The console will be valid immediately after the connection has
    // initialized. So hook it up then.
    if (interceptLogs) {
      const {hookUpRemoteConsole} = await import('../intercept-logs');
      hookUpRemoteConsole(connection.console);
    }
    return server;
  }

  /**
   * Called once we've got an initialized connection, a working polymer
   * editor service, and a workspace.
   */
  constructor(connection: IConnection, workspaceUri: Uri) {
    super();
    this._disposables.push(connection);
    this._connection = connection;

    const workspacePath = workspaceUri.fsPath;

    // TODO(rictic): try out implementing an incrementally synced version of
    //     TextDocuments. Should be a performance win for editing large docs.
    this._documents = new TextDocuments();
    this._documents.listen(connection);
    this.converter = new AnalyzerLSPConverter(workspaceUri);

    const synchronizer = new FileSynchronizer(
        connection, this._documents, workspacePath, this.converter);

    this._settings = new Settings(connection, synchronizer, this.converter);
    this._disposables.push(this._settings);

    this._editorService = new LocalEditorService({
      urlLoader: synchronizer.urlLoader,
      urlResolver: new PackageUrlResolver(),
      settings: this._settings
    });

    this._disposables.push(
        this._settings.projectConfigChangeStream.listen(() => {
          // Our lint rules may have changed. Report updated warnings.
          this._reportWarnings();
        }));

    this._disposables.push(
        synchronizer.fileChanges.listen((filesChangeEvents) => {
          this.handleFilesChanged(filesChangeEvents);
        }));
    this.fileSynchronizer = synchronizer;

    this._initEventHandlers();
  }

  private capabilities(clientCapabilities: ClientCapabilities):
      ServerCapabilities {
    const ourCapabilities: ServerCapabilities = {
      textDocumentSync: {
        change: this._documents.syncKind,
        openClose: true,
        willSaveWaitUntil: true
      },
      completionProvider: {resolveProvider: false},
      hoverProvider: true,
      definitionProvider: true,
      codeActionProvider: true,
    };
    // If the client can apply edits, then we can handle the
    // polymer-ide/applyEdit command, which just delegates to the client's
    // applyEdit functionality. Otherwise the client plugin can handle the
    // polymer-ide/applyEdit if it wants that feature.
    if (clientCapabilities.workspace &&
        clientCapabilities.workspace.applyEdit) {
      ourCapabilities.executeCommandProvider = {
        commands: [applyEditCommandName, applyAllFixesCommandName]
      };
    }
    return ourCapabilities;
  }

  private _initEventHandlers() {
    this._disposables.push(this._documents.onDidClose(async(event) => {
      if (!this._settings.analyzeWholePackage) {
        // If the user hasn't asked for whole-package analysis then it's
        // annoying to see warnings for files that aren't open, and in any
        // case, we'll never update those diagnostics while the file is closed.
        this._connection.sendDiagnostics(
            {diagnostics: [], uri: event.document.uri});
      }
    }));

    this._connection.onHover(async(textPosition) => {
      return this.handleErrors(
          this.getDocsForHover(textPosition), undefined) as Promise<Hover>;
    });

    this._connection.onDefinition(async(textPosition) => {
      return this.handleErrors(
          this.getDefinition(textPosition), undefined) as Promise<Definition>;
    });

    this._connection.onCompletion(async(textPosition) => {
      return this.handleErrors(
          this.autoComplete(textPosition), {isIncomplete: true, items: []});
    });

    this._connection.onCodeAction(async(req) => {
      return this.handleErrors(this.getCodeActions(req), []);
    });

    this._connection.onExecuteCommand(async(req) => {
      if (req.command === applyEditCommandName) {
        return this.handleErrors(
            this.executeApplyEditCommand(req.arguments as [WorkspaceEdit]),
            undefined);
      }
      if (req.command === applyAllFixesCommandName) {
        return this.handleErrors(this.executeApplyAllFixesCommand(), undefined);
      }
    });

    this._connection.onWillSaveTextDocumentWaitUntil((req) => {
      if (this._settings.fixOnSave) {
        return this.handleErrors(this.fixOnSave(req), []);
      }
      return [];
    });

    this._disposables.push(this._settings.changeStream.listen(
        (change) => this._handleSettingsChange(change)));
  }

  private async getCodeActions(req: CodeActionParams) {
    const commands: Command[] = [];
    if (req.context.diagnostics.length === 0) {
      // Currently we only support code actions on Warnings,
      // so we can early-exit in the case where there aren't any.
      return commands;
    }
    const {warnings} = await this._editorService.getWarningsForFile(
        this.converter.getWorkspacePathToFile(req.textDocument));
    const requestedRange =
        this.converter.convertLRangeToP(req.range, req.textDocument);
    for (const warning of warnings) {
      if ((!warning.fix &&
           (!warning.actions || warning.actions.length === 0)) ||
          !isRangeInside(warning.sourceRange, requestedRange)) {
        continue;
      }
      if (warning.fix) {
        commands.push(this.createApplyEditCommand(
            `Quick fix the '${warning.code}' warning`, warning.fix));
      }
      if (warning.actions) {
        for (const action of warning.actions) {
          if (action.kind !== 'edit') {
            continue;
          }
          commands.push(this.createApplyEditCommand(
              // Take up to the first newline.
              action.description.split('\n')[0], action.edit));
        }
      }
    }
    return commands;
  }

  private async executeApplyEditCommand(args: [WorkspaceEdit]) {
    await this.applyEdits(args[0]);
  }

  private async executeApplyAllFixesCommand() {
    const {warnings, analysis} =
        await this._editorService.getWarningsForPackage();
    const fixes = [];
    for (const warning of warnings) {
      if (warning.fix) {
        fixes.push(warning.fix);
      }
    }
    // Don't apply conflicting edits to the workspace.
    const parseLoader = makeParseLoader(this._editorService.analyzer, analysis);
    const {appliedEdits} = await applyEdits(fixes, parseLoader);
    await this.applyEdits(this.converter.editsToWorkspaceEdit(appliedEdits));
  }

  private async applyEdits(workspaceEdit: WorkspaceEdit) {
    const params: ApplyWorkspaceEditParams = {edit: workspaceEdit};
    return (await this._connection.sendRequest(
        ApplyWorkspaceEditRequest.type.method,
        params)) as ApplyWorkspaceEditResponse;
  }

  private createApplyEditCommand(title: string, edit: Edit): Command {
    return Command.create(
        title, applyEditCommandName, this.converter.editToWorkspaceEdit(edit));
  }

  private async autoComplete(textPosition: TextDocumentPositionParams):
      Promise<CompletionList> {
    const localPath =
        this.converter.getWorkspacePathToFile(textPosition.textDocument);
    const completions =
        await this._editorService.getTypeaheadCompletionsAtPosition(
            localPath, this.converter.convertPosition(textPosition.position));
    if (!completions) {
      return {isIncomplete: false, items: []};
    }
    if (completions.kind === 'element-tags') {
      return {
        isIncomplete: false,
        items: completions.elements.map(c => {
          return {
            label: `<${c.tagname}>`,
            kind: CompletionItemKind.Class,
            documentation: c.description,
            insertText: c.expandTo
          };
        }),
      };
    } else if (completions.kind === 'attributes') {
      return {
        isIncomplete: false,
        items: completions.attributes.map(attributeCompletionToCompletionItem),
      };
    } else if (completions.kind === 'properties-in-polymer-databinding') {
      return {
        isIncomplete: false,
        items: completions.properties.map(attributeCompletionToCompletionItem)
      };
    }
    return {isIncomplete: false, items: []};
  }

  private async getDefinition(textPosition: TextDocumentPositionParams):
      Promise<Definition|undefined> {
    const localPath =
        this.converter.getWorkspacePathToFile(textPosition.textDocument);
    const location =
        await this._editorService.getDefinitionForFeatureAtPosition(
            localPath, this.converter.convertPosition(textPosition.position));
    if (location && location.file) {
      let definition: Location = {
        uri: this.converter.getUriForLocalPath(location.file),
        range: this.converter.convertPRangeToL(location)
      };
      return definition;
    }
  }

  private async getDocsForHover(textPosition: TextDocumentPositionParams):
      Promise<Hover|undefined> {
    const localPath =
        this.converter.getWorkspacePathToFile(textPosition.textDocument);
    const documentation = await this._editorService.getDocumentationAtPosition(
        localPath, this.converter.convertPosition(textPosition.position));
    if (documentation) {
      return {contents: documentation};
    }
  }

  private async handleFilesChanged(fileChangeEvents: FileEvent[]) {
    const paths = fileChangeEvents.map(
        change => this.converter.getWorkspacePathToFile(change));
    if (paths.length === 0) {
      return;  // no new information in this notification
    }
    const deletions =
        fileChangeEvents
            .filter((change) => change.type === FileChangeType.Deleted)
            .map((change) => this.converter.getWorkspacePathToFile(change));
    if (deletions.length > 0) {
      // When a directory is deleted we may not be told about individual
      // files, we'll have to determine the tracked files ourselves.
      // This involves mucking around in private implementation details of
      // the analyzer, so we wrap this in a try/catch.
      // Analyzer issue for a supported API:
      // https://github.com/Polymer/polymer-analyzer/issues/761
      try {
        const context: AnalysisContext =
            await this._editorService.analyzer['_analysisComplete'];
        const cache: AnalysisCache = context['_cache'];
        const cachedPaths = new Set<ResolvedUrl>([
          ...cache.failedDocuments.keys(),
          ...cache.parsedDocumentPromises['_keyToResultMap'].keys()
        ]);
        for (const deletedPath of deletions) {
          const deletedDir = deletedPath + '/';
          for (const cachedPath of cachedPaths) {
            if (cachedPath.startsWith(deletedDir)) {
              paths.push(cachedPath);
            }
          }
        }
      } catch {
        // Mucking about in analyzer internals on a best effort basis here.
      }
    }
    // Clear the files from any caches and recalculate warnings as needed.
    await this._editorService.analyzer.filesChanged(paths);
    await this._reportWarnings();
  }

  private async handleErrors<Result, Fallback>(
      promise: Promise<Result>,
      fallbackValue: Fallback): Promise<Result|Fallback> {
    try {
      return await promise;
    } catch (err) {
      // Ignore WarningCarryingExceptions, they're expected, and made visible
      //   to the user in a useful way. All other exceptions should be logged
      //   if possible.
      if (!(err instanceof WarningCarryingException)) {
        this._connection.console.warn(err.stack || err.message || err);
      }
      return fallbackValue;
    }
  }

  /**
   * Used so that if we don't have any warnings to report for a file on the
   * next go around we can remember to send an empty array.
   */
  private _urisReportedWarningsFor = new Set<string>();
  private async _reportWarnings(): Promise<void> {
    if (this._settings.analyzeWholePackage) {
      const {warnings} = await this._editorService.getWarningsForPackage();
      this._reportPackageWarnings(warnings);
    } else {
      for (const document of this._documents.all()) {
        const localPath = this.converter.getWorkspacePathToFile(document);
        const {warnings} =
            await this._editorService.getWarningsForFile(localPath);
        this._connection.sendDiagnostics({
          diagnostics: warnings.map(
              this.converter.convertWarningToDiagnostic, this.converter),
          uri: document.uri
        });
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
      this._connection.sendDiagnostics({uri, diagnostics});
    }
    for (const uriWithNoWarnings of reportedLastTime) {
      this._connection.sendDiagnostics(
          {uri: uriWithNoWarnings, diagnostics: []});
    }
    this._urisReportedWarningsFor = new Set(diagnosticsByUri.keys());
  }

  private async fixOnSave(req: WillSaveTextDocumentParams):
      Promise<TextEdit[]> {
    const path = this.converter.getWorkspacePathToFile(req.textDocument);
    const {warnings, analysis} =
        await this._editorService.getWarningsForFile(path);
    const edits: Edit[] = [];
    for (const warning of warnings) {
      if (!warning.fix) {
        continue;
      }
      // A fix can touch multiple files. We can only update this document
      // though, so skip any fixes that touch others.
      if (warning.fix.some(repl => repl.range.file !== path)) {
        continue;
      }
      edits.push(warning.fix);
    }
    const {appliedEdits} = await applyEdits(
        edits, makeParseLoader(this._editorService.analyzer, analysis));
    const textEdits: TextEdit[] = [];
    for (const appliedEdit of appliedEdits) {
      for (const replacement of appliedEdit) {
        textEdits.push(TextEdit.replace(
            this.converter.convertPRangeToL(replacement.range),
            replacement.replacementText));
      }
    }
    return textEdits;
  }

  private async _handleSettingsChange(change: Change<SettingsJson>) {
    const {newer, older} = change;
    if (newer.analyzeWholePackage !== older.analyzeWholePackage) {
      // When we switch this setting we want to be sure that we'll clear out
      // warnings that were reported with the old setting but not the new
      // one.
      if (newer.analyzeWholePackage) {
        this._urisReportedWarningsFor = new Set(this._documents.keys());
      } else {
        for (const uri of this._urisReportedWarningsFor) {
          this._connection.sendDiagnostics({uri, diagnostics: []});
        }
      }
      this._reportWarnings();
    }
  }
}

function attributeCompletionToCompletionItem(
    attrCompletion: AttributeCompletion) {
  const item: CompletionItem = {
    label: attrCompletion.name,
    kind: CompletionItemKind.Field,
    documentation: attrCompletion.description,
    sortText: attrCompletion.sortKey
  };
  if (attrCompletion.type) {
    item.detail = `{${attrCompletion.type}}`;
  }
  if (attrCompletion.inheritedFrom) {
    if (item.detail) {
      item.detail = `${item.detail} ⊃ ${attrCompletion.inheritedFrom}`;
    } else {
      item.detail = `⊃ ${attrCompletion.inheritedFrom}`;
    }
  }
  return item;
}

function isRangeInside(inner: SourceRange, outer: SourceRange) {
  return isPositionInsideRange(inner.start, outer, true) &&
      isPositionInsideRange(inner.end, outer, true);
}
