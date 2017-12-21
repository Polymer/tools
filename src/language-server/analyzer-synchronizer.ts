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

import {Analysis, Analyzer, AnalyzerOptions, ResolvedUrl, UrlResolver} from 'polymer-analyzer';
import {AnalysisCache} from 'polymer-analyzer/lib/core/analysis-cache';
import {AnalysisContext} from 'polymer-analyzer/lib/core/analysis-context';
import {FileChangeType, FileEvent, TextDocuments} from 'vscode-languageserver';

import AnalyzerLSPConverter from './converter';
import FileSynchronizer from './file-synchronizer';
import {Logger} from './logger';
import {AutoDisposable, EventStream} from './util';

/**
 * Exposes an Analyzer that is always in sync with the client's state,
 * and that can give the versions of open files when a given Analysis was
 * generated.
 */
export default class AnalyzerSynchronizer extends AutoDisposable {
  public readonly analyzer: LsAnalyzer;
  /**
   * An event stream that fires every time files have changed such that
   * re-analyzing may give different results.
   *
   * We don't expose the list of files changed here because the file the
   * user is interested in may depend on one of the files changed. The
   * Analyzer is smart about this, so we'll return cached results almost
   * instantly if nothing has actually changed.
   */
  public readonly analysisChanges: EventStream<void>;
  constructor(
      private readonly documents: TextDocuments,
      fileSynchronizer: FileSynchronizer, logger: Logger,
      urlResolver: UrlResolver,
      private readonly converter: AnalyzerLSPConverter) {
    super();

    const {fire, stream} = EventStream.create<void>();
    this.analysisChanges = stream;
    const analysisVersionMap = new WeakMap<Analysis, Map<string, number>>();
    this.analyzer = new LsAnalyzer(this.documents, logger, analysisVersionMap, {
      urlLoader: fileSynchronizer.urlLoader,
      urlResolver,
    });

    this.disposables.push(
        fileSynchronizer.fileChanges.listen((filesChangeEvents) => {
          this.handleFilesChanged(filesChangeEvents, fire);
        }));
  }

  private async handleFilesChanged(
      fileChangeEvents: FileEvent[], onComplete: (value: void) => void) {
    const uris = fileChangeEvents.map((f) => f.uri);
    // Changes to polymer.json are handled through the Settings object.
    // If the analyzer ever starts to care about that file we should listen to
    // the Settings change stream here for it, in order to avoid doing duplicate
    // work.
    fileChangeEvents = fileChangeEvents.filter(
        change =>
            this.converter.getWorkspacePathToFile(change) !== 'polymer.json');
    if (fileChangeEvents.length === 0) {
      return;  // no new information in this notification
    }
    const deletedUris =
        fileChangeEvents
            .filter((change) => change.type === FileChangeType.Deleted)
            .map((change) => change.uri);
    if (deletedUris.length > 0) {
      // When a directory is deleted we may not be told about individual
      // files, we'll have to determine the tracked files ourselves.
      // This involves mucking around in private implementation details of
      // the analyzer, so we wrap this in a try/catch.
      // Analyzer issue for a supported API:
      // https://github.com/Polymer/polymer-analyzer/issues/761
      try {
        const context: AnalysisContext =
            await this.analyzer['_analysisComplete'];
        const cache: AnalysisCache = context['_cache'];
        const cachedUris = new Set<ResolvedUrl>([
          ...cache.failedDocuments.keys(),
          ...cache.parsedDocumentPromises['_keyToResultMap'].keys()
        ]);
        for (const deletedUri of deletedUris) {
          const deletedDir = deletedUri + '/';
          for (const cachedUri of cachedUris) {
            if (cachedUri.startsWith(deletedDir)) {
              uris.push(cachedUri);
            }
          }
        }
      } catch {
        // Mucking about in analyzer internals on a best effort basis here.
      }
    }
    // Clear the files from any caches and recalculate warnings as needed.
    const filesChangedPromise = this.analyzer.filesChanged(uris);
    // After we've called filesChanged, future calls to analyze will get
    // the updated results, we don't need to wait on the filesChangedPromise
    // to actually resolve.
    onComplete(undefined);
    await filesChangedPromise;
  }
}

/**
 * An extension of the analyzer that's aware of the LSP versions of
 * in-memory files at the time an analysis is generated.
 */
export class LsAnalyzer extends Analyzer {
  constructor(
      private documents: TextDocuments, private logger: Logger,
      private analysisVersionMap:
          WeakMap<Analysis, ReadonlyMap<string, number>>,
      options: AnalyzerOptions) {
    super(options);
  }

  analyze(files: string[], reason?: string): Promise<Analysis> {
    const prefix = reason ? `${reason}: ` : '';
    this.logger.log(`${prefix}Analyzing files: ${files.join(', ')}`);
    const start = (new Date().getTime());
    const result = this.annotateWithVersionMap(super.analyze(files));
    result.then(() => {
      const end = (new Date().getTime());
      const elapsed = ((end - start) / 1000).toFixed(2);
      this.logger.log(
          `${prefix}Took ${elapsed}s to analyze files: ${files.join(', ')}`);
    });
    return result;
  }

  analyzePackage(reason?: string): Promise<Analysis> {
    const prefix = reason ? `${reason}: ` : '';
    this.logger.log(`${prefix}Analyzing package...`);
    const start = (new Date().getTime());
    const result = this.annotateWithVersionMap(super.analyzePackage());
    result.then(() => {
      const end = (new Date().getTime());
      const elapsed = ((end - start) / 1000).toFixed(2);
      this.logger.log(`${prefix}:Took ${elapsed}s to analyze package.`);
    });
    return result;
  }

  private async annotateWithVersionMap(promise: Promise<Analysis>) {
    const versionMap = new Map<string, number>();
    for (const document of this.documents.all()) {
      versionMap.set(document.uri, document.version);
    }
    const analysis = await promise;
    this.analysisVersionMap.set(analysis, versionMap);
    return analysis;
  }

  /**
   * Gives a map from URI to version number for all open files at the moment
   * that the given Analysis was generated.
   *
   * This is useful for getting versions right when applying edits.
   */
  getVersionsAtAnalysis(analysis: Analysis): ReadonlyMap<string, number> {
    return this.analysisVersionMap.get(analysis)!;
  }
}
