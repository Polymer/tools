/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

/// <reference path="../../custom_typings/main.d.ts" />

import * as path from 'path';

import {FileRelativeUrl} from '../index';
import {Analysis, Document, Warning} from '../model/model';
import {PackageRelativeUrl, ResolvedUrl} from '../model/url';
import {Parser} from '../parser/parser';
import {Scanner} from '../scanning/scanner';
import {FSUrlLoader} from '../url-loader/fs-url-loader';
import {PackageUrlResolver} from '../url-loader/package-url-resolver';
import {UrlLoader} from '../url-loader/url-loader';
import {UrlResolver} from '../url-loader/url-resolver';

import {AnalysisContext} from './analysis-context';

export interface Options {
  urlLoader: UrlLoader;
  urlResolver?: UrlResolver;
  parsers?: Map<string, Parser<any>>;
  scanners?: ScannerTable;
  /*
   * Map from url of an HTML Document to another HTML document it lazily depends
   * on.
   */
  lazyEdges?: LazyEdgeMap;

  // For internal use
  __contextPromise?: Promise<AnalysisContext>;
}

/**
 * These are the options available to the `_fork` method.  Currently, only the
 * `urlLoader` override is implemented.
 */
export interface ForkOptions { urlLoader?: UrlLoader; }

export class NoKnownParserError extends Error {};

export type ScannerTable = Map<string, Scanner<any, any, any>[]>;
export type LazyEdgeMap = Map<ResolvedUrl, PackageRelativeUrl[]>;

/**
 * A static analyzer for web projects.
 *
 * An Analyzer can load and parse documents of various types, and extract
 * arbitrary information from the documents, and transitively load
 * dependencies. An Analyzer instance is configured with parsers, and scanners
 * which do the actual work of understanding different file types.
 */
export class Analyzer {
  private _analysisComplete: Promise<AnalysisContext>;
  readonly urlResolver: UrlResolver;
  private readonly _urlLoader: UrlLoader;

  constructor(options: Options) {
    if (options.__contextPromise) {
      this._urlLoader = options.urlLoader;
      this.urlResolver = options.urlResolver!;
      this._analysisComplete = options.__contextPromise;
    } else {
      const context = new AnalysisContext(options);
      this.urlResolver = context.resolver;
      this._urlLoader = context.loader;
      this._analysisComplete = Promise.resolve(context);
    }
  }

  /**
   * Returns an analyzer with configuration inferred for the given directory.
   *
   * Currently this just creates a simple analyzer with a FS loader rooted
   * at the given directory, but in the future it may take configuration from
   * files including polymer.json or similar.
   */
  static createForDirectory(dirname: string): Analyzer {
    return new Analyzer({
      urlLoader: new FSUrlLoader(dirname),
      urlResolver: new PackageUrlResolver({packageDir: dirname})
    });
  }

  /**
   * Loads, parses and analyzes the root document of a dependency graph and its
   * transitive dependencies.
   */
  async analyze(urls: string[]): Promise<Analysis> {
    const previousAnalysisComplete = this._analysisComplete;
    const uiUrls = this.brandUserInputUrls(urls);
    this._analysisComplete = (async () => {
      const previousContext = await previousAnalysisComplete;
      return await previousContext.analyze(uiUrls);
    })();
    const context = await this._analysisComplete;
    const resolvedUrls = context.resolveUserInputUrls(uiUrls);
    return this._constructAnalysis(context, resolvedUrls);
  }

  async analyzePackage(): Promise<Analysis> {
    const previousAnalysisComplete = this._analysisComplete;
    let analysis: Analysis;
    this._analysisComplete = (async () => {
      const previousContext = await previousAnalysisComplete;
      if (!previousContext.loader.readDirectory) {
        throw new Error(
            `This analyzer doesn't support analyzerPackage, ` +
            `the urlLoader can't list the files in a directory.`);
      }
      const allFiles =
          await previousContext.loader.readDirectory('' as ResolvedUrl, true);
      // TODO(rictic): parameterize this, perhaps with polymer.json.
      const filesInPackage =
          allFiles.filter((file) => !Analysis.isExternal(file));
      const extensions = new Set(previousContext.parsers.keys());
      const filesWithParsers = filesInPackage.filter(
          (fn) => extensions.has(path.extname(fn).substring(1)));

      const newContext = await previousContext.analyze(filesWithParsers);
      const resolvedFilesWithParsers =
          newContext.resolveUserInputUrls(filesWithParsers);
      analysis = this._constructAnalysis(newContext, resolvedFilesWithParsers);
      return newContext;
    })();
    await this._analysisComplete;
    return analysis!;
  }

  private _constructAnalysis(
      context: AnalysisContext, urls: ReadonlyArray<ResolvedUrl>) {
    const getUrlResultPair:
        (url: ResolvedUrl) => [ResolvedUrl, Document | Warning] =
            (url) => [url, context.getDocument(url)];
    return new Analysis(new Map(urls.map(getUrlResultPair)), context);
  }

  /**
   * Clears all information about the given files from our caches, such that
   * future calls to analyze() will reload these files if they're needed.
   *
   * The analyzer assumes that if this method isn't called with a file's url,
   * then that file has not changed and does not need to be reloaded.
   *
   * @param urls The urls of files which may have changed.
   */
  async filesChanged(urls: string[]): Promise<void> {
    const previousAnalysisComplete = this._analysisComplete;
    this._analysisComplete = (async () => {
      const previousContext = await previousAnalysisComplete;
      return await previousContext.filesChanged(this.brandUserInputUrls(urls));
    })();
    await this._analysisComplete;
  }

  /**
   * Clear all cached information from this analyzer instance.
   *
   * Note: if at all possible, instead tell the analyzer about the specific
   * files that changed rather than clearing caches like this. Caching provides
   * large performance gains.
   */
  async clearCaches(): Promise<void> {
    const previousAnalysisComplete = this._analysisComplete;
    this._analysisComplete = (async () => {
      const previousContext = await previousAnalysisComplete;
      return await previousContext.clearCaches();
    })();
    await this._analysisComplete;
  }

  /**
   * Returns a copy of the analyzer.  If options are given, the AnalysisContext
   * is also forked and individual properties are overridden by the options.
   * is forked with the given options.
   *
   * When the analysis context is forked, its cache is preserved, so you will
   * see a mixture of pre-fork and post-fork contents when you analyze with a
   * forked analyzer.
   *
   * Note: this feature is experimental. It may be removed without being
   *     considered a breaking change, so check for its existence before calling
   *     it.
   */
  _fork(options?: ForkOptions): Analyzer {
    const contextPromise = (async () => {
      return options ?
          (await this._analysisComplete)._fork(undefined, options) :
          (await this._analysisComplete);
    })();
    return new Analyzer({
      urlLoader: this._urlLoader,
      urlResolver: this.urlResolver,
      __contextPromise: contextPromise
    });
  }

  /**
   * Returns `true` if the provided resolved URL can be loaded.  Obeys the
   * semantics defined by `UrlLoader` and should only be used to check
   * resolved URLs.
   */
  canLoad(resolvedUrl: ResolvedUrl): boolean {
    return this._urlLoader.canLoad(resolvedUrl);
  }

  /**
   * Loads the content at the provided resolved URL.  Obeys the semantics
   * defined by `UrlLoader` and should only be used to attempt to load resolved
   * URLs.
   */
  async load(resolvedUrl: ResolvedUrl) {
    return (await this._analysisComplete).load(resolvedUrl);
  }

  /**
   * Resoves `url` to a new location.
   */
  resolveUrl(url: string): ResolvedUrl|undefined {
    return this.urlResolver.resolve(url as FileRelativeUrl);
  }

  // Urls from the user are assumed to be package relative
  private brandUserInputUrls(urls: string[]): PackageRelativeUrl[] {
    return urls as PackageRelativeUrl[];
  }
}
