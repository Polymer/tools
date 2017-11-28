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

import {InMemoryOverlayUrlLoader, UrlLoader} from 'polymer-analyzer';
import {FSUrlLoader} from 'polymer-analyzer/lib/url-loader/fs-url-loader';
import {FileChangeType, FileEvent, IConnection, TextDocuments} from 'vscode-languageserver';

import AnalyzerLSPConverter from './converter';
import {AutoDisposable, EventStream} from './util';

/**
 * Handles synchronizing and firing events for changes to files, either in
 * open text editors or on disk.
 *
 * This class is responsible for maintaining a URL Loader that always returns
 * the latest known content for a given url when requested, and for exposing an
 * EventStream of FileEvents.
 */
export default class FileSynchronizer extends AutoDisposable {
  /** This maps workspace path to content of our in-memory documents. */
  private inMemoryDocuments: Map<string, string>;
  readonly urlLoader: UrlLoader;
  fileChanges: EventStream<FileEvent[]>;
  constructor(
      connection: IConnection, documents: TextDocuments, baseDir: string,
      converter: AnalyzerLSPConverter) {
    super();
    const fileLoader = new FSUrlLoader(baseDir);
    const inMemoryOverlayLoader = new InMemoryOverlayUrlLoader(fileLoader);
    this.inMemoryDocuments = inMemoryOverlayLoader.urlContentsMap;
    this.urlLoader = inMemoryOverlayLoader;

    const {fire, stream} = EventStream.create<FileEvent[]>();
    this.fileChanges = stream;
    this._disposables.push(documents.onDidChangeContent((change) => {
      // A document has changed in memory!
      const workspacePath = converter.getWorkspacePathToFile(change.document);
      this.inMemoryDocuments.set(workspacePath, change.document.getText());

      // Publish document change so other parts of the system can react.
      fire([{type: FileChangeType.Changed, uri: change.document.uri}]);
    }));

    this._disposables.push(documents.onDidClose((event) => {
      // The file is no longer managed in memory, so we should delete it from
      // the in-memory map.
      this.inMemoryDocuments.delete(
          converter.getWorkspacePathToFile(event.document));
      fire([{type: FileChangeType.Changed, uri: event.document.uri}]);
    }));

    connection.onDidChangeWatchedFiles((req) => {
      const inMemoryURIs = new Set(documents.keys());
      // We will get documents.onDidChangeContent events for changes of
      // in-memory buffers, so we filter them out to avoid sending duplicate
      // events for those changes.
      const diskBackedChanges =
          req.changes.filter(ch => !inMemoryURIs.has(ch.uri));
      fire(diskBackedChanges);
    });
  }
}
