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

import * as util from 'util';
import {ClientCapabilities, IConnection, InitializeResult, ServerCapabilities, TextDocuments} from 'vscode-languageserver';
import Uri from 'vscode-uri';

import AnalyzerSynchronizer from './analyzer-synchronizer';
import AutoCompleter from './auto-completer';
import CommandExecutor, {allSupportedCommands} from './commands';
import AnalyzerLSPConverter from './converter';
import DefinitionFinder from './definition-finder';
import DiagnosticGenerator from './diagnostics';
import FeatureFinder from './feature-finder';
import FileSynchronizer from './file-synchronizer';
import HoverDocumenter from './hover-documenter';
import {Logger} from './logger';
import Settings from './settings';
import {Handler} from './util';

export default class LanguageServer extends Handler {
  private readonly converter: AnalyzerLSPConverter;
  protected readonly connection: IConnection;
  private readonly documents: TextDocuments;
  readonly fileSynchronizer: FileSynchronizer;
  private readonly diagnosticGenerator: DiagnosticGenerator;
  private readonly settings: Settings;

  /** Get an initialized and ready language server. */
  static async initializeWithConnection(
      connection: IConnection,
      interceptLogging = true): Promise<LanguageServer> {
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

    // When we get an initialization request we want to construct a server and
    // tell the client about its capabilities.
    const server = await new Promise<LanguageServer>((resolve, reject) => {
      connection.onInitialize((params): InitializeResult => {
        // Normalize across the two ways that the workspace may be
        // communicated to us.
        const workspaceUri = getWorkspaceUri(params.rootUri, params.rootPath);
        if (!workspaceUri || workspaceUri.scheme !== 'file') {
          const error = new Error(
              `Got invalid workspaceUri from client: ` +
              `${util.inspect(workspaceUri)}`);
          reject(error);
          throw error;
        }
        const newServer =
            new LanguageServer(connection, workspaceUri, params.capabilities);
        resolve(newServer);
        return {capabilities: newServer.capabilities(params.capabilities)};
      });
    });

    // The console will be valid immediately after the connection has
    // initialized. So hook it up then (if requested).
    if (interceptLogging) {
      const {hookUpRemoteConsole} = await import('../intercept-logs');
      hookUpRemoteConsole(connection.console);
    }
    return server;
  }

  /**
   * Called once we've got an initialized connection, a working polymer
   * editor service, and a workspace.
   */
  constructor(
      connection: IConnection, workspaceUri: Uri,
      clientCapabilities: ClientCapabilities) {
    super();
    this.disposables.push(connection);
    this.connection = connection;

    const logger = new Logger(connection);
    this.disposables.push(logger);

    const workspacePath = workspaceUri.fsPath;

    // TODO(rictic): try out implementing an incrementally synced version of
    //     TextDocuments. Should be a performance win for editing large docs.
    this.documents = new TextDocuments();
    this.documents.listen(connection);
    this.converter = new AnalyzerLSPConverter(workspaceUri);

    this.fileSynchronizer = new FileSynchronizer(
        connection, this.documents, workspacePath, this.converter, logger);

    this.settings =
        new Settings(connection, this.fileSynchronizer, this.converter);
    this.disposables.push(this.settings);

    logger.hookupSettings(this.settings);

    logger.log(`\n\n\n\n\nInitialized with workspace path: ${workspacePath}`);

    const analyzerSynchronizer = new AnalyzerSynchronizer(
        this.documents, this.fileSynchronizer, this.converter, logger);

    this.diagnosticGenerator = new DiagnosticGenerator(
        analyzerSynchronizer.analyzer, this.converter, connection,
        this.settings, analyzerSynchronizer, this.documents);
    this.disposables.push(this.diagnosticGenerator);

    const commandExecutor =
        new CommandExecutor(this.connection, this.diagnosticGenerator);
    this.disposables.push(commandExecutor);

    const featureFinder = new FeatureFinder(analyzerSynchronizer.analyzer);
    const hoverDocumenter = new HoverDocumenter(
        this.connection, this.converter, featureFinder, logger);
    this.disposables.push(hoverDocumenter);

    const autoCompleter = new AutoCompleter(
        this.connection, this.converter, featureFinder,
        analyzerSynchronizer.analyzer, clientCapabilities);
    this.disposables.push(autoCompleter);

    const definitionFinder = new DefinitionFinder(
        this.connection, this.converter, featureFinder,
        analyzerSynchronizer.analyzer, this.settings);
    this.disposables.push(definitionFinder);
  }

  private capabilities(clientCapabilities: ClientCapabilities):
      ServerCapabilities {
    const ourCapabilities: ServerCapabilities = {
      textDocumentSync: {
        change: this.documents.syncKind,
        openClose: true,
        willSaveWaitUntil: true
      },
      completionProvider: {resolveProvider: false},
      hoverProvider: true,
      definitionProvider: true,
      codeActionProvider: true,
      referencesProvider: true,
      documentSymbolProvider: true,
      workspaceSymbolProvider: true,
      codeLensProvider: {},
    };
    // If the client can apply edits, then we can handle the
    // polymer-ide/applyEdit command, which just delegates to the client's
    // applyEdit functionality. Otherwise the client plugin can handle the
    // polymer-ide/applyEdit if it wants that feature.
    if (clientCapabilities.workspace &&
        clientCapabilities.workspace.applyEdit) {
      ourCapabilities.executeCommandProvider = {commands: allSupportedCommands};
    }
    return ourCapabilities;
  }
}
