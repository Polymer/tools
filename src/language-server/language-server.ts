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

import {UrlResolver} from 'polymer-analyzer';
import {PackageUrlResolver} from 'polymer-analyzer/lib/url-loader/package-url-resolver';
import * as util from 'util';
import {ClientCapabilities, IConnection, InitializeResult, ServerCapabilities, TextDocuments, TextDocumentSyncKind} from 'vscode-languageserver';
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

export interface LoggingOptions {
  interceptConsole: boolean;
  logToFile?: string;
}

export default class LanguageServer extends Handler {
  protected readonly connection: IConnection;
  readonly fileSynchronizer: FileSynchronizer;
  private readonly syncKind: TextDocumentSyncKind;

  /** Get an initialized and ready language server. */
  static async initializeWithConnection(
      connection: IConnection,
      loggingOptions: LoggingOptions): Promise<LanguageServer> {
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
      connection.onInitialize(async(params): Promise<InitializeResult> => {
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
        const urlResolver =
            new PackageUrlResolver({packageDir: workspaceUri.fsPath});
        const newServer = new LanguageServer(
            connection, workspaceUri, params.capabilities, urlResolver,
            loggingOptions.logToFile);
        resolve(newServer);
        return {capabilities: newServer.capabilities(params.capabilities)};
      });
    });

    // The console will be valid immediately after the connection has
    // initialized. So hook it up then (if requested).
    if (loggingOptions.interceptConsole) {
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
      clientCapabilities: ClientCapabilities, urlResolver: UrlResolver,
      logToFile: string|undefined) {
    super();
    this.disposables.push(connection);
    this.connection = connection;

    const logger = new Logger({connection, logToFileFlag: logToFile});
    this.disposables.push(logger);

    const workspacePath = workspaceUri.fsPath;

    // TODO(rictic): try out implementing an incrementally synced version of
    //     TextDocuments. Should be a performance win for editing large docs.
    const documents = new TextDocuments();
    documents.listen(connection);
    this.syncKind = documents.syncKind;
    const converter = new AnalyzerLSPConverter(workspaceUri, urlResolver);

    this.fileSynchronizer = new FileSynchronizer(
        connection, documents, workspacePath, converter, logger);

    logger.log(`\n\n\n\n\nInitialized with workspace path: ${workspacePath}`);
    logger.log(`Client's capabilities:`);
    logger.log(JSON.stringify(clientCapabilities, null, 2));
    logger.log(`\n\nServer's capabilities:`);
    logger.log(JSON.stringify(this.capabilities(clientCapabilities), null, 2));

    const analyzerSynchronizer = new AnalyzerSynchronizer(
        documents, this.fileSynchronizer, logger, urlResolver, converter);

    const settings = new Settings(
        connection, this.fileSynchronizer, analyzerSynchronizer.analyzer);
    this.disposables.push(settings);
    logger.hookupSettings(settings);

    const diagnosticGenerator = new DiagnosticGenerator(
        analyzerSynchronizer.analyzer, converter, connection, settings,
        analyzerSynchronizer, documents);
    this.disposables.push(diagnosticGenerator);

    const commandExecutor =
        new CommandExecutor(this.connection, diagnosticGenerator);
    this.disposables.push(commandExecutor);

    const featureFinder = new FeatureFinder(analyzerSynchronizer.analyzer);
    const hoverDocumenter =
        new HoverDocumenter(this.connection, converter, featureFinder, logger);
    this.disposables.push(hoverDocumenter);

    const autoCompleter = new AutoCompleter(
        this.connection, converter, featureFinder,
        analyzerSynchronizer.analyzer, clientCapabilities);
    this.disposables.push(autoCompleter);

    const definitionFinder = new DefinitionFinder(
        this.connection, converter, featureFinder,
        analyzerSynchronizer.analyzer, settings);
    this.disposables.push(definitionFinder);
  }

  private capabilities(clientCapabilities: ClientCapabilities):
      ServerCapabilities {
    const ourCapabilities: ServerCapabilities = {
      textDocumentSync:
          {change: this.syncKind, openClose: true, willSaveWaitUntil: true},
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
