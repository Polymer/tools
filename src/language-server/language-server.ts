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

import * as path from 'path';
import {applyEdits, Edit, FSUrlLoader, isPositionInsideRange, makeParseLoader, PackageUrlResolver, SourceRange, WarningCarryingException} from 'polymer-analyzer';
import * as util from 'util';
import {ApplyWorkspaceEditParams, ApplyWorkspaceEditRequest, ApplyWorkspaceEditResponse, ClientCapabilities, CodeActionParams, Command, CompletionItem, CompletionItemKind, CompletionList, Definition, Diagnostic, Disposable, Hover, IConnection, InitializeResult, Location, ServerCapabilities, TextDocument, TextDocumentPositionParams, TextDocuments, TextEdit, WillSaveTextDocumentParams, WorkspaceEdit} from 'vscode-languageserver';
import Uri from 'vscode-uri';

import {AttributeCompletion, Warning} from '../editor-service';
import {hookUpRemoteConsole} from '../intercept-logs';
import {LocalEditorService} from '../local-editor-service';

import AnalyzerLSPConverter from './converter';


export class AutoDisposable implements Disposable {
  dispose(): void {
    for (const disposable of this._disposables) {
      disposable.dispose();
    }
  }

  protected readonly _disposables: Disposable[] = [];
}


interface SettingsWrapper {
  'polymer-ide'?: Partial<Settings>;
}

interface Settings {
  analyzeWholePackage: boolean;
  fixOnSave: boolean;
}
const defaultSettings: Readonly<Settings> =
    Object.freeze({analyzeWholePackage: false, fixOnSave: false});

const applyEditCommandName = 'polymer-ide/applyEdit';

const applyAllFixesCommandName: string = 'polymer-ide/applyAllFixes';

export default class LanguageServer extends AutoDisposable {
  readonly converter: AnalyzerLSPConverter;
  private readonly _connection: IConnection;
  private readonly _editorService: LocalEditorService;

  private readonly _documents: TextDocuments;

  private _settings: Settings = defaultSettings;

  /** Get an initialized and ready language server. */
  static async initializeWithConnection(connection: IConnection):
      Promise<LanguageServer> {
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
      const workspacePath = workspaceUri.fsPath;
      const polymerJsonPath = path.join(workspacePath, 'polymer.json');
      const editorService = new LocalEditorService({
        urlLoader: new FSUrlLoader(workspacePath),
        urlResolver: new PackageUrlResolver(), polymerJsonPath
      });
      return new LanguageServer(connection, editorService, workspaceUri);
    }

    // When we get an initialization request we want to construct a server from
    // the given URI and return its capabilities.
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
    hookUpRemoteConsole(connection.console);
    return server;
  }

  /**
   * Called once we've got an initialized connection, a working polymer
   * editor service, and a workspace.
   */
  constructor(
      connection: IConnection, editorService: LocalEditorService,
      workspaceUri: Uri) {
    super();
    this._disposables.push(connection);
    this._connection = connection;
    this._editorService = editorService;

    // TODO(rictic): try out implementing an incrementally synced version of
    //     TextDocuments. Should be a performance win for editing large docs.
    this._documents = new TextDocuments();
    this._documents.listen(connection);
    this.converter = new AnalyzerLSPConverter(workspaceUri);

    this._initEventHandlers();
  }

  capabilities(clientCapabilities: ClientCapabilities): ServerCapabilities {
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
    this._disposables.push(this._documents.onDidChangeContent((change) => {
      return this.handleErrors(
          this.handleChangedDocument(change.document), undefined);
    }));

    this._disposables.push(this._documents.onDidClose((event) => {
      if (!this._settings.analyzeWholePackage) {
        this._connection.sendDiagnostics(
            {diagnostics: [], uri: event.document.uri});
      }
      // TODO(rictic): unmap event.document.uri from the in-memory map.
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

    this._connection.onDidChangeConfiguration((change) => {
      const settingsWrapper = <SettingsWrapper|undefined>change.settings;
      const settings = settingsWrapper && settingsWrapper['polymer-ide'] || {};
      const previousSettings = this._settings;
      this._settings = {...defaultSettings, ...settings};
      this._settingsChanged(this._settings, previousSettings);
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
  }

  private async getCodeActions(req: CodeActionParams) {
    const commands: Command[] = [];
    if (req.context.diagnostics.length === 0) {
      // Currently we only support code actions on Warnings,
      // so we can early-exit in the case where there aren't any.
      return commands;
    }
    const warnings = await this._editorService.getWarningsForFile(
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
    const warnings = await this._editorService.getWarningsForPackage();
    const fixes = [];
    for (const warning of warnings) {
      if (warning.fix) {
        fixes.push(warning.fix);
      }
    }
    // Don't apply conflicting edits to the workspace.
    const parseLoader =
        makeParseLoader(this._editorService.analyzer, warnings.analysis);
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

  async autoComplete(textPosition: TextDocumentPositionParams):
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

  async getDefinition(textPosition: TextDocumentPositionParams):
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

  async getDocsForHover(textPosition: TextDocumentPositionParams):
      Promise<Hover|undefined> {
    const localPath =
        this.converter.getWorkspacePathToFile(textPosition.textDocument);
    const documentation = await this._editorService.getDocumentationAtPosition(
        localPath, this.converter.convertPosition(textPosition.position));
    if (documentation) {
      return {contents: documentation};
    }
  }

  async handleChangedDocument(document: TextDocument) {
    const localPath = this.converter.getWorkspacePathToFile(document);
    await this._editorService.fileChanged(localPath, document.getText());
    await this._reportWarnings();
  }

  async handleErrors<Result, Fallback>(
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
      this._reportPackageWarnings(
          await this._editorService.getWarningsForPackage());
    } else {
      for (const document of this._documents.all()) {
        const localPath = this.converter.getWorkspacePathToFile(document);
        const warnings =
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
    const warnings = await this._editorService.getWarningsForFile(path);
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
        edits,
        makeParseLoader(this._editorService.analyzer, warnings.analysis));
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

  private _settingsChanged(newer: Settings, older: Settings) {
    if (newer.analyzeWholePackage !== older.analyzeWholePackage) {
      // When we switch this setting we want to be sure that we'll clear out
      // warnings that were reported with the old setting but not the new one.
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
