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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {SourcePosition, SourceRange, UrlLoader} from 'polymer-analyzer';
import {CodeUnderliner as BaseUnderliner} from 'polymer-analyzer/lib/test/test-utils';
import {Duplex} from 'stream';
import {CompletionList, CompletionRequest, createConnection, Definition, Diagnostic, DidChangeTextDocumentNotification, DidChangeTextDocumentParams, DidCloseTextDocumentNotification, DidCloseTextDocumentParams, DidOpenTextDocumentNotification, DidOpenTextDocumentParams, Hover, HoverRequest, IConnection, InitializeParams, Location, PublishDiagnosticsNotification, PublishDiagnosticsParams, ReferenceParams, ReferencesRequest, TextDocumentPositionParams, TextDocuments} from 'vscode-languageserver';
import {DefinitionRequest, InitializeRequest, InitializeResult} from 'vscode-languageserver-protocol';
import URI from 'vscode-uri/lib';

import AnalyzerLSPConverter from '../language-server/converter';
import FileSynchronizer from '../language-server/file-synchronizer';
import LanguageServer from '../language-server/language-server';

export function createTestConnections(debugging?: boolean) {
  const up = new TestStream('up', debugging);
  const down = new TestStream('down', debugging);
  const serverConnection: IConnection = createConnection(up, down);
  const clientConnection: IConnection = createConnection(down, up);
  serverConnection.listen();
  clientConnection.listen();
  return {serverConnection, clientConnection};
}

export function createFileSynchronizer(baseDir?: string, debugging?: boolean) {
  if (baseDir) {
    baseDir = getTempCopy(baseDir);
  } else {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-service-tests'));
  }

  const {serverConnection, clientConnection} = createTestConnections(debugging);
  const textDocuments = new TextDocuments();
  textDocuments.listen(serverConnection);
  const converter = new AnalyzerLSPConverter(URI.file(baseDir));
  const synchronizer =
      new FileSynchronizer(serverConnection, textDocuments, baseDir, converter);
  return {synchronizer, serverConnection, clientConnection, baseDir, converter};
}

/**
 * Creates a full test environment for integration testing.
 *
 * The results include a running server and a test client with slightly
 * friendlier wrapper methods around the raw protocol requests, as well as
 * a configured underliner for producing squiggle underlined strings for
 * asserting against.                    ~~~~~~~~~~~~~~~~~~~
 *
 * So tests written using this method can use the client as a fake text editor,
 * and send requests up to the server, then assert on the responses from the
 * server.
 *
 * @param baseDir If given, then the test environment will be set up with a
 *     copy of the given basedir in os.tempdir() as the client's workspace.
 *     If this param is not passed, an empty tempdir will be used.
 * @param debugging If true, does extra logging about the requests and responses
 *     between client and server.
 */
export async function createTestEnvironment(
    baseDir?: string, debugging?: boolean) {
  if (baseDir) {
    baseDir = getTempCopy(baseDir);
  } else {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-service-tests'));
  }

  const {serverConnection, clientConnection} = createTestConnections(debugging);
  const converter = new AnalyzerLSPConverter(URI.file(baseDir));
  const client = new TestClient(clientConnection, converter, baseDir);
  const serverPromise =
      LanguageServer.initializeWithConnection(serverConnection, false);
  const initResult = await client.initialize(baseDir);
  const server = await serverPromise;
  const underliner =
      new Underliner(server.fileSynchronizer.urlLoader, converter);
  return {client, server, baseDir, initResult, underliner};
}

export class Underliner extends BaseUnderliner {
  constructor(urlLoader: UrlLoader, private converter: AnalyzerLSPConverter) {
    super(urlLoader);
  }
  underline(reference: SourceRange): Promise<string>;
  underline(references: SourceRange[]): Promise<string[]>;
  underline(location: Location): Promise<string>;
  underline(location: Location[]): Promise<string[]>;
  underline(location: Location|Array<Location>|undefined|
            null): Promise<string|Array<string>>;
  underline(location: undefined|null): Promise<string>;
  async underline(location: any): Promise<string|string[]> {
    if (location == null) {
      return `Got nullish value instead of location.`;
    }
    if (Array.isArray(location)) {
      return Promise.all<string>(location.map((l) => this.underline(l)));
    }
    if (Location.is(location)) {
      return this.underline(
          this.converter.convertLRangeToP(location.range, location));
    }
    return super.underline(location);
  }

  async underlineDiagnostics(diagnostics: Diagnostic[], path: string):
      Promise<string[]> {
    const document = {uri: this.converter.getUriForLocalPath(path)};
    return this.underline(diagnostics.map(
        d => this.converter.convertLRangeToP(d.range, document)));
  }
}

export class TestClient {
  constructor(
      public connection: IConnection, public converter: AnalyzerLSPConverter,
      private baseDir: string) {
    connection.onNotification(PublishDiagnosticsNotification.type, (params) => {
      this.handleDiagnostics(params);
    });
  }

  async initialize(baseDir: string): Promise<InitializeResult> {
    const init: InitializeParams = {
      rootPath: baseDir,
      rootUri: URI.file(baseDir).toString(),
      processId: -1,
      initializationOptions: {},
      capabilities: {
        textDocument: {
          completion: {completionItem: {snippetSupport: true}},
          synchronization:
              {didSave: true, willSave: true, willSaveWaitUntil: true}
        },
        workspace: {
          applyEdit: true,
          workspaceEdit: {documentChanges: true},
        }
      }
    };
    return this.connection.sendRequest(InitializeRequest.type, init);
  }

  async getHover(path: string, position: SourcePosition):
      Promise<Hover|undefined> {
    const params: TextDocumentPositionParams = {
      position: this.converter.convertSourcePosition(position),
      textDocument: {uri: this.converter.getUriForLocalPath(path)}
    };
    return this.connection.sendRequest(HoverRequest.type, params);
  }

  async getDefinition(path: string, position: SourcePosition):
      Promise<Definition|undefined> {
    const params: TextDocumentPositionParams = {
      position: this.converter.convertSourcePosition(position),
      textDocument: {uri: this.converter.getUriForLocalPath(path)}
    };
    return this.connection.sendRequest(DefinitionRequest.type, params);
  }

  private openFiles = new Set<string>();
  async openFile(filePath: string, initialContents?: string) {
    if (this.openFiles.has(filePath)) {
      throw new Error(`${filePath} is already open`);
    }
    this.openFiles.add(filePath);
    if (initialContents === undefined) {
      initialContents =
          fs.readFileSync(path.join(this.baseDir, filePath), 'utf-8');
    }
    const params: DidOpenTextDocumentParams = {
      textDocument: {
        languageId: guessLanguageId(filePath),
        text: initialContents,
        uri: this.converter.getUriForLocalPath(filePath),
        version: this.getNextVersionFor(filePath)
      }
    };
    return this.connection.sendNotification(
        DidOpenTextDocumentNotification.type, params);
  }

  async changeFile(path: string, updatedContents: string) {
    if (!this.openFiles.has(path)) {
      throw new Error(`Tried to change ${path} before opening it`);
    }
    const params: DidChangeTextDocumentParams = {
      textDocument: {
        uri: this.converter.getUriForLocalPath(path),
        version: this.getNextVersionFor(path)
      },
      contentChanges: [{
        range: {
          start: {line: 0, character: 0},
          end: {line: Math.pow(10, 10), character: Math.pow(10, 10)}
        },
        rangeLength: undefined,
        text: updatedContents
      }]
    };
    return this.connection.sendNotification(
        DidChangeTextDocumentNotification.type, params);
  }

  async closeFile(path: string) {
    if (!this.openFiles.has(path)) {
      throw new Error(`Tried to close ${path} when it was not open.`);
    }
    this.openFiles.delete(path);
    const params: DidCloseTextDocumentParams = {
      textDocument: {uri: this.converter.getUriForLocalPath(path)}
    };
    return this.connection.sendNotification(
        DidCloseTextDocumentNotification.type, params);
  }
  private diagnosticsForPath =
      new MapSetDefault<string, StreamWithNext<Diagnostic[]>>(
          (key) => new StreamWithNext(key));
  private async handleDiagnostics(params: PublishDiagnosticsParams) {
    const path = this.converter.getWorkspacePathToFile(params);
    this.diagnosticsForPath.get(path).push(params.diagnostics);
  }

  async getNextDiagnostics(path: string) {
    return this.diagnosticsForPath.get(path).next();
  }

  async getCompletions(path: string, position: SourcePosition):
      Promise<CompletionList> {
    const params: TextDocumentPositionParams = {
      position: this.converter.convertSourcePosition(position),
      textDocument: {uri: this.converter.getUriForLocalPath(path)}
    };
    return this.connection.sendRequest(
        CompletionRequest.type, params) as Promise<CompletionList>;
  }

  async getReferences(
      path: string, position: SourcePosition,
      includeDefinition = false): Promise<Location[]> {
    const params: ReferenceParams = {
      position: this.converter.convertSourcePosition(position),
      textDocument: {uri: this.converter.getUriForLocalPath(path)},
      context: {includeDeclaration: includeDefinition}
    };
    return this.connection.sendRequest(ReferencesRequest.type, params);
  }

  private latestVersionMap = new Map<string, number>();
  private getNextVersionFor(path: string) {
    let version = this.latestVersionMap.get(path);
    if (version == null) {
      version = -1;
    }
    version++;
    this.latestVersionMap.set(path, version);
    return version;
  }
}

function guessLanguageId(path: string) {
  if (path.endsWith('.html')) {
    return 'html';
  } else if (path.endsWith('.js')) {
    return 'javascript';
  } else if (path.endsWith('.json')) {
    return 'json';
  } else if (path.endsWith('.css')) {
    return 'css';
  }
  throw new Error(`Can't guess language id for: ${path}`);
}

class StreamWithNext<V> {
  constructor(private key: string, private debugging = false) {
  }
  private queue: V[] = [];
  private wakeup: () => void = () => undefined;
  private wakeupPromise: Promise<void>|undefined = undefined;

  private log(msg: string) {
    if (this.debugging) {
      console.log(`${this.key}: ${msg}`);
    }
  }
  push(val: V) {
    this.log(`pushing a value`);
    this.queue.push(val);
    this.wakeup();
    this.wakeupPromise = undefined;
  }

  async next(): Promise<V> {
    while (true) {
      if (this.queue.length > 0) {
        this.log(`${this.key}: shifting a value`);
        return this.queue.shift()!;
      }
      if (!this.wakeupPromise) {
        this.wakeupPromise = new Promise((resolve) => this.wakeup = resolve);
      }
      this.log(`${this.key}: waiting for a value`);
      await this.wakeupPromise;
    }
  }
}

class MapSetDefault<K, V> extends Map<K, V> {
  constructor(
      private defaultFactory: (key: K) => V, initial?: Iterable<[K, V]>) {
    super(initial || []);
  }

  get(key: K) {
    let val = super.get(key);
    if (val === undefined) {
      val = this.defaultFactory(key);
      this.set(key, val);
    }
    return val;
  }
}

/** Duplex stream that optionally logs content. */
class TestStream extends Duplex {
  constructor(public name: string, private debugging?: boolean) {
    super();
  }

  _write(chunk: string, _encoding: string, done: () => void) {
    if (this.debugging) {
      console.log(`this.name writes: ${chunk}`);
    }
    this.emit('data', chunk);
    done();
  }

  _read(_size: number) {
  }
}

export function getTempCopy(fromDir: string) {
  const toDir = fs.mkdtempSync(path.join(os.tmpdir(), path.basename(fromDir)));
  copyDir(fromDir, toDir);
  return toDir;
}

export function copyDir(fromDir: string, toDir: string) {
  for (const inner of fs.readdirSync(fromDir)) {
    const fromInner = path.join(fromDir, inner);
    const toInner = path.join(toDir, inner);
    const stat = fs.statSync(fromInner);
    if (stat.isDirectory()) {
      fs.mkdirSync(toInner);
      copyDir(fromInner, toInner);
    } else {
      fs.writeFileSync(toInner, fs.readFileSync(fromInner));
    }
  }
}

/** Fails if the given promise either resolves or rejects within the timeout. */
export async function assertDoesNotSettle(
    promise: Promise<any>, timeoutMs = 100) {
  return new Promise((resolve, reject) => {
    promise.then(
        () =>
            reject(new Error('Promise resolved, was not expected to settle.')),
        () =>
            reject(new Error('Promise rejected, was not expected to settle.')));
    setTimeout(resolve, timeoutMs);
  });
}
