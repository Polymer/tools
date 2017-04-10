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
import {FSUrlLoader, PackageUrlResolver, WarningCarryingException} from 'polymer-analyzer';
import * as util from 'util';
import {CompletionItem, CompletionItemKind, CompletionList, Definition, Disposable, Hover, IConnection, InitializeResult, Location, ServerCapabilities, TextDocument, TextDocumentPositionParams, TextDocuments} from 'vscode-languageserver';
import Uri from 'vscode-uri';

import {AttributeCompletion, EditorService} from '../editor-service';
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
};


export default class LanguageServer extends AutoDisposable {
  readonly converter: AnalyzerLSPConverter;
  private readonly _connection: IConnection;
  private readonly _editorService: EditorService;

  private readonly _documents: TextDocuments;

  private readonly _workspaceUri: Uri;

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
        let workspaceUri = getWorkspaceUri(params.rootUri, params.rootPath);
        if (!workspaceUri || workspaceUri.scheme !== 'file') {
          reject(
              `Got invalid workspaceUri from client: ` +
              `${util.inspect(workspaceUri)}`);
          return {capabilities: {}};
        }
        const newServer = makeServer(workspaceUri);
        resolve(newServer);
        return {capabilities: newServer.capabilities};
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
      connection: IConnection, editorService: EditorService,
      workspaceUri: Uri) {
    super();
    this._disposables.push(connection);
    this._connection = connection;
    this._editorService = editorService;
    this._workspaceUri = workspaceUri;

    this._documents = new TextDocuments();
    this._documents.listen(connection);
    this.converter = new AnalyzerLSPConverter(workspaceUri);

    this._initEventHandlers();
  }

  get capabilities(): ServerCapabilities {
    return {
      textDocumentSync: this._documents.syncKind,
      completionProvider: {resolveProvider: false},
      hoverProvider: true,
      definitionProvider: true,
    };
  }

  private _initEventHandlers() {
    this._disposables.push(this._documents.onDidChangeContent((change) => {
      return this.handleErrors(
          this.handleChangedDocument(change.document), undefined);
    }));

    this._disposables.push(this._documents.onDidClose((event) => {
      // TODO(rictic): if the user wants to get package-level warnings, don't
      //     clear diagnostics like this when the file is closed.
      this._connection.sendDiagnostics(
          {diagnostics: [], uri: event.document.uri});

      // TODO(rictic): unmap event.document.uri from the in-memory map.
    }));

    this._connection.onHover(async(textPosition) => {
      return this.handleErrors(this.getDocsForHover(textPosition), undefined);
    });

    this._connection.onDefinition(async(textPosition) => {
      return this.handleErrors(this.getDefinition(textPosition), undefined);
    });

    this._connection.onCompletion(async(textPosition) => {
      return this.handleErrors(
          this.autoComplete(textPosition), {isIncomplete: true, items: []});
    });
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
        range: this.converter.convertRange(location)
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
    await this.reportErrors();
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

  async reportErrors() {
    // TODO(rictic): allow the user to set in a setting that they like warnings
    //     at the package level, in which case we should call something like
    //     getWarningsForPackage instead of going through each open document.
    for (const document of this._documents.all()) {
      const localPath = this.converter.getWorkspacePathToFile(document);
      const warnings = await this._editorService.getWarningsForFile(localPath);
      this._connection.sendDiagnostics({
        diagnostics: warnings.map(
            this.converter.convertWarningToDiagnostic, this.converter),
        uri: document.uri
      });
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
