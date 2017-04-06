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

/// <reference path="../custom_typings/main.d.ts" />

import {AnalysisContext} from './core/analysis-context';
import {Document, Package} from './model/model';
import {Parser} from './parser/parser';
import {Scanner} from './scanning/scanner';
import {UrlLoader} from './url-loader/url-loader';
import {UrlResolver} from './url-loader/url-resolver';

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
}

/**
 * These are the options available to the `_fork` method.  Currently, only the
 * `urlLoader` override is implemented.
 */
export interface ForkOptions { urlLoader?: UrlLoader; }

export class NoKnownParserError extends Error {};

export type ScannerTable = Map<string, Scanner<any, any, any>[]>;
export type LazyEdgeMap = Map<string, string[]>;

/**
 * A static analyzer for web projects.
 *
 * An Analyzer can load and parse documents of various types, and extract
 * arbitrary information from the documents, and transitively load
 * dependencies. An Analyzer instance is configured with parsers, and scanners
 * which do the actual work of understanding different file types.
 */
export class Analyzer {
  private _context: AnalysisContext;
  constructor(options: Options|AnalysisContext) {
    if (options instanceof AnalysisContext) {
      this._context = options;
    } else {
      this._context = new AnalysisContext(options);
    }
  }

  /**
   * Loads, parses and analyzes the root document of a dependency graph and its
   * transitive dependencies.
   */
  async analyze(url: string): Promise<Document> {
    return this._context.analyze(url);
  }

  async analyzePackage(): Promise<Package> {
    return this._context.analyzePackage();
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
  filesChanged(urls: string[]) {
    this._context = this._context.filesChanged(urls);
  }

  /**
   * Clear all cached information from this analyzer instance.
   *
   * Note: if at all possible, instead tell the analyzer about the specific
   * files that changed rather than clearing caches like this. Caching provides
   * large performance gains.
   */
  clearCaches(): void {
    this._context = this._context.clearCaches();
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
    const context = this._context._fork(undefined, options);
    return new Analyzer(context);
  }

  /**
   * Loads the content at the provided resolved URL.
   */
  async load(resolvedUrl: string) {
    return this._context.load(resolvedUrl);
  }

  canResolveUrl(url: string): boolean {
    return this._context.canResolveUrl(url);
  }

  resolveUrl(url: string): string {
    return this._context.resolveUrl(url);
  }
}
