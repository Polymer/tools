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

import {AnalyzerCacheContext} from './core/analyzer-cache-context';
import {Document, Package} from './model/model';
import {Parser} from './parser/parser';
import {Measurement} from './perf/telemetry';
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

export class NoKnownParserError extends Error {};

export type ScannerTable = Map<string, Scanner<any, any, any>[]>;
export type LazyEdgeMap = Map<string, string[]>;

/**
 * A static analyzer for web projects.
 *
 * An Analyzer can load and parse documents of various types, and extract
 * arbitratrary information from the documents, and transitively load
 * dependencies. An Analyzer instance is configured with parsers, and scanners
 * which do the actual work of understanding different file types.
 */
export class Analyzer {
  private _cacheContext: AnalyzerCacheContext;
  constructor(options: Options) {
    this._cacheContext = new AnalyzerCacheContext(options);
  }

  /**
   * Loads, parses and analyzes the root document of a dependency graph and its
   * transitive dependencies.
   *
   * Note: The analyzer only supports analyzing a single root for now. This
   * is because each analyzed document in the dependency graph has a single
   * root. This mean that we can't properly analyze app-shell-style, lazy
   * loading apps.
   *
   * @param contents Optional contents of the file when it is known without
   * reading it from disk. Clears the caches so that the news contents is used
   * and reanalyzed. Useful for editors that want to re-analyze changed files.
   */
  async analyze(url: string, contents?: string): Promise<Document> {
    if (contents != null) {
      this._cacheContext = this._cacheContext.filesChanged([url]);
    }
    return this._cacheContext.analyze(url, contents);
  }

  async analyzePackage(): Promise<Package> {
    return this._cacheContext.analyzePackage();
  }

  async getTelemetryMeasurements(): Promise<Measurement[]> {
    return this._cacheContext.getTelemetryMeasurements();
  }

  /**
   * Clear all cached information from this analyzer instance.
   *
   * Note: if at all possible, instead tell the analyzer about the specific
   * files that changed rather than clearing caches like this. Caching provides
   * large performance gains.
   */
  clearCaches(): void {
    this._cacheContext = this._cacheContext.clearCaches();
  }

  /**
   * Loads the content at the provided resolved URL.
   *
   * Currently does no caching. If the provided contents are given then they
   * are used instead of hitting the UrlLoader (e.g. when you have in-memory
   * contents that should override disk).
   */
  async load(resolvedUrl: string, providedContents?: string) {
    return this._cacheContext.load(resolvedUrl, providedContents);
  }
}
