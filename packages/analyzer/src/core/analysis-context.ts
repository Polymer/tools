/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {isCancel} from 'cancel-token';
import * as path from 'path';

import {ForkOptions, LazyEdgeMap, NoKnownParserError, Options, ScannerTable} from '../core/analyzer';
import {CssCustomPropertyScanner} from '../css/css-custom-property-scanner';
import {CssParser} from '../css/css-parser';
import {HtmlCustomElementReferenceScanner} from '../html/html-element-reference-scanner';
import {HtmlImportScanner} from '../html/html-import-scanner';
import {HtmlParser} from '../html/html-parser';
import {HtmlScriptScanner} from '../html/html-script-scanner';
import {HtmlStyleScanner} from '../html/html-style-scanner';
import {ClassScanner} from '../javascript/class-scanner';
import {FunctionScanner} from '../javascript/function-scanner';
import {InlineHtmlDocumentScanner} from '../javascript/html-template-literal-scanner';
import {JavaScriptExportScanner} from '../javascript/javascript-export-scanner';
import {JavaScriptImportScanner} from '../javascript/javascript-import-scanner';
import {JavaScriptParser} from '../javascript/javascript-parser';
import {NamespaceScanner} from '../javascript/namespace-scanner';
import {JsonParser} from '../json/json-parser';
import {Result} from '../model/analysis';
import {Document, InlineDocInfo, LocationOffset, ScannedDocument, ScannedElement, ScannedImport, ScannedInlineDocument, Severity, Warning, WarningCarryingException} from '../model/model';
import {PackageRelativeUrl, ResolvedUrl} from '../model/url';
import {ParsedDocument, UnparsableParsedDocument} from '../parser/document';
import {Parser} from '../parser/parser';
import {BehaviorScanner} from '../polymer/behavior-scanner';
import {CssImportScanner} from '../polymer/css-import-scanner';
import {DomModuleScanner} from '../polymer/dom-module-scanner';
import {PolymerCoreFeatureScanner} from '../polymer/polymer-core-feature-scanner';
import {PolymerElementScanner} from '../polymer/polymer-element-scanner';
import {PseudoElementScanner} from '../polymer/pseudo-element-scanner';
import {scan} from '../scanning/scan';
import {Scanner} from '../scanning/scanner';
import {PackageUrlResolver} from '../url-loader/package-url-resolver';
import {UrlLoader} from '../url-loader/url-loader';
import {UrlResolver} from '../url-loader/url-resolver';

import {AnalysisCache} from './analysis-cache';
import {MinimalCancelToken} from './cancel-token';
import {LanguageAnalyzer} from './language-analyzer';

export const analyzerVersion: string = require('../../package.json').version;

/**
 * An analysis of a set of files at a specific point-in-time with respect to
 * updates to those files. New files can be added to an existing context, but
 * updates to files will cause a fork of the context with new analysis results.
 *
 * All file contents and analysis results are consistent within a single
 * anaysis context. A context is forked via either the fileChanged or
 * clearCaches methods.
 *
 * For almost all purposes this is an entirely internal implementation detail.
 * An Analyzer instance has a reference to its current context, so it will
 * appear to be statefull with respect to file updates.
 */
export class AnalysisContext {
  readonly parsers = new Map<string, Parser<ParsedDocument>>([
    ['html', new HtmlParser()],
    ['js', new JavaScriptParser()],
    ['mjs', new JavaScriptParser()],
    ['css', new CssParser()],
    ['json', new JsonParser()],
  ]);

  private readonly _languageAnalyzers = new Map<string, LanguageAnalyzer<{}>>([
    // TODO(rictic): add typescript language analyzer back after investigating
    //     https://github.com/Polymer/polymer-analyzer/issues/623
  ]);

  /** A map from import url to urls that document lazily depends on. */
  private readonly _lazyEdges: LazyEdgeMap|undefined;

  private readonly _scanners: ScannerTable;

  readonly loader: UrlLoader;
  readonly resolver: UrlResolver;

  private readonly _cache: AnalysisCache;

  /** Incremented each time we fork. Useful for debugging. */
  private readonly _generation: number;

  /**
   * Resolves when the previous analysis has completed.
   *
   * Used to serialize analysis requests, not for correctness surprisingly
   * enough, but for performance, so that we can reuse AnalysisResults.
   */
  private _analysisComplete: Promise<void>;

  static getDefaultScanners(options: Options) {
    return new Map<string, Scanner<ParsedDocument, {}|null|undefined, {}>[]>([
      [
        'html',
        [
          new HtmlImportScanner(options.lazyEdges),
          new HtmlScriptScanner(),
          new HtmlStyleScanner(),
          new DomModuleScanner(),
          new CssImportScanner(),
          new HtmlCustomElementReferenceScanner(),
          new PseudoElementScanner(),
        ]
      ],
      [
        'js',
        [
          new PolymerElementScanner(),
          new PolymerCoreFeatureScanner(),
          new BehaviorScanner(),
          new NamespaceScanner(),
          new FunctionScanner(),
          new ClassScanner(),
          new JavaScriptImportScanner(
              {moduleResolution: options.moduleResolution}),
          new JavaScriptExportScanner(),
          new InlineHtmlDocumentScanner(),
        ]
      ],
      ['css', [new CssCustomPropertyScanner()]]
    ]);
  }

  constructor(options: Options, cache?: AnalysisCache, generation?: number) {
    this.loader = options.urlLoader;
    this.resolver = options.urlResolver || new PackageUrlResolver();
    this.parsers = options.parsers || this.parsers;
    this._lazyEdges = options.lazyEdges;
    this._scanners =
        options.scanners || AnalysisContext.getDefaultScanners(options);
    this._cache = cache || new AnalysisCache();
    this._generation = generation || 0;
    this._analysisComplete = Promise.resolve();
  }

  /**
   * Returns a copy of this cache context with proper cache invalidation.
   */
  filesChanged(urls: PackageRelativeUrl[]) {
    const newCache = this._cache.invalidate(this.resolveUserInputUrls(urls));
    return this._fork(newCache);
  }

  /**
   * Implements Analyzer#analyze, see its docs.
   */
  async analyze(urls: PackageRelativeUrl[], cancelToken: MinimalCancelToken):
      Promise<AnalysisContext> {
    const resolvedUrls = this.resolveUserInputUrls(urls);

    // 1. Await current analysis if there is one, so we can check to see if it
    // has all of the requested URLs.
    await this._analysisComplete;

    // 2. Check to see if we have all of the requested documents
    const hasAllDocuments = resolvedUrls.every(
        (url) => this._cache.analyzedDocuments.get(url) != null);
    if (hasAllDocuments) {
      // all requested URLs are present, return the existing context
      return this;
    }

    // 3. Some URLs are new, so fork, but don't invalidate anything
    const newCache = this._cache.invalidate([]);
    const newContext = this._fork(newCache);
    return newContext._analyze(resolvedUrls, cancelToken);
  }

  /**
   * Internal analysis method called when we know we need to fork.
   */
  private async _analyze(
      resolvedUrls: ResolvedUrl[],
      cancelToken: MinimalCancelToken): Promise<AnalysisContext> {
    const analysisComplete = (async () => {
      // 1. Load and scan all root documents
      const maybeScannedDocuments =
          await Promise.all(resolvedUrls.map(async (url) => {
            try {
              const scannedResult = await this.scan(url, cancelToken);
              if (scannedResult.successful === true) {
                this._cache.failedDocuments.delete(url);
                return scannedResult.value;
              } else {
                this._cache.failedDocuments.set(url, scannedResult.error);
                return undefined;
              }
            } catch (e) {
              if (isCancel(e)) {
                return;
              }
              // This is a truly unexpected error. We should fail.
              throw e;
            }
          }));
      const scannedDocuments = maybeScannedDocuments.filter(
                                   (d) => d !== undefined) as ScannedDocument[];
      // 2. Run per-document resolution
      const documents = scannedDocuments.map((d) => this.getDocument(d.url));
      // TODO(justinfagnani): instead of the above steps, do:
      // 1. Load and run prescanners
      // 2. Run global analyzers (_languageAnalyzers now, but it doesn't need to
      //    be separated by file type)
      // 3. Run per-document scanners and resolvers
      return documents;
    })();
    this._analysisComplete = analysisComplete.then((_) => {});
    await this._analysisComplete;
    return this;
  }

  /**
   * Gets an analyzed Document from the document cache. This is only useful for
   * Analyzer plugins. You almost certainly want to use `analyze()` instead.
   *
   * If a document has been analyzed, it returns the analyzed Document. If not
   * the scanned document cache is used and a new analyzed Document is returned.
   * If a file is in neither cache, it returns `undefined`.
   */
  getDocument(resolvedUrl: ResolvedUrl): Document|Warning {
    const cachedWarning = this._cache.failedDocuments.get(resolvedUrl);
    if (cachedWarning) {
      return cachedWarning;
    }
    const cachedResult = this._cache.analyzedDocuments.get(resolvedUrl);
    if (cachedResult) {
      return cachedResult;
    }
    const scannedDocument = this._cache.scannedDocuments.get(resolvedUrl);
    if (!scannedDocument) {
      return makeRequestedWithoutLoadingWarning(resolvedUrl);
    }

    const extension = path.extname(resolvedUrl).substring(1);
    const languageAnalyzer = this._languageAnalyzers.get(extension);
    let analysisResult;
    if (languageAnalyzer) {
      analysisResult = languageAnalyzer.analyze(scannedDocument.url);
    }

    const document = new Document(scannedDocument, this, analysisResult);
    this._cache.analyzedDocuments.set(resolvedUrl, document);
    this._cache.analyzedDocumentPromises.getOrCompute(
        resolvedUrl, async () => document);

    document.resolve();
    return document;
  }

  /**
   * This is only useful for Analyzer plugins.
   *
   * If a url has been scanned, returns the ScannedDocument.
   */
  _getScannedDocument(resolvedUrl: ResolvedUrl): ScannedDocument|undefined {
    return this._cache.scannedDocuments.get(resolvedUrl);
  }

  /**
   * Clear all cached information from this analyzer instance.
   *
   * Note: if at all possible, instead tell the analyzer about the specific
   * files that changed rather than clearing caches like this. Caching provides
   * large performance gains.
   */
  clearCaches(): AnalysisContext {
    return this._fork(new AnalysisCache());
  }

  /**
   * Returns a copy of the context but with optional replacements of cache or
   * constructor options.
   *
   * Note: this feature is experimental.
   */
  _fork(cache?: AnalysisCache, options?: ForkOptions): AnalysisContext {
    const contextOptions: Options = {
      lazyEdges: this._lazyEdges,
      parsers: this.parsers,
      scanners: this._scanners,
      urlLoader: this.loader,
      urlResolver: this.resolver,
    };
    if (options && options.urlLoader) {
      contextOptions.urlLoader = options.urlLoader;
    }
    if (!cache) {
      cache = this._cache.invalidate([]);
    }
    const copy =
        new AnalysisContext(contextOptions, cache, this._generation + 1);
    return copy;
  }

  /**
   * Scans a file locally, that is for features that do not depend
   * on this files imports. Local features can be cached even when
   * imports are invalidated. This method does not trigger transitive
   * scanning, _scan() does that.
   *
   * TODO(justinfagnani): consider renaming this to something like
   * _preScan, since about the only useful things it can find are
   * imports, exports and other syntactic structures.
   */
  private async _scanLocal(
      resolvedUrl: ResolvedUrl, cancelToken: MinimalCancelToken):
      Promise<Result<ScannedDocument, Warning>> {
    return this._cache.scannedDocumentPromises.getOrCompute(
        resolvedUrl, async () => {
          const parsedDocResult = await this._parse(resolvedUrl, cancelToken);
          if (parsedDocResult.successful === false) {
            this._cache.dependencyGraph.rejectDocument(
                resolvedUrl,
                new WarningCarryingException(parsedDocResult.error));
            return parsedDocResult;
          }
          const parsedDoc = parsedDocResult.value;

          try {
            const scannedDocument = await this._scanDocument(parsedDoc);

            const imports =
                scannedDocument.getNestedFeatures().filter(
                    (e) => e instanceof ScannedImport) as ScannedImport[];

            // Update dependency graph
            const importUrls = filterOutUndefineds(imports.map(
                (i) => i.url === undefined ?
                    undefined :
                    this.resolver.resolve(parsedDoc.baseUrl, i.url, i)));
            this._cache.dependencyGraph.addDocument(resolvedUrl, importUrls);

            return {successful: true, value: scannedDocument};
          } catch (e) {
            const message = (e && e.message) || `Unknown error during scan.`;
            const warning = new Warning({
              code: 'could-not-scan',
              message,
              parsedDocument: parsedDoc,
              severity: Severity.ERROR,
              sourceRange: {
                file: resolvedUrl,
                start: {column: 0, line: 0},
                end: {column: 0, line: 0}
              }
            });
            this._cache.dependencyGraph.rejectDocument(
                resolvedUrl, new WarningCarryingException(warning));
            return {successful: false, error: warning};
          }
        }, cancelToken);
  }

  /**
   * Scan a toplevel document and all of its transitive dependencies.
   */
  async scan(resolvedUrl: ResolvedUrl, cancelToken: MinimalCancelToken):
      Promise<Result<ScannedDocument, Warning>> {
    return this._cache.dependenciesScannedPromises.getOrCompute(
        resolvedUrl, async () => {
          const scannedDocumentResult =
              await this._scanLocal(resolvedUrl, cancelToken);
          if (scannedDocumentResult.successful === false) {
            return scannedDocumentResult;
          }
          const scannedDocument = scannedDocumentResult.value;
          const imports =
              scannedDocument.getNestedFeatures().filter(
                  (e) => e instanceof ScannedImport) as ScannedImport[];

          // Scan imports
          for (const scannedImport of imports) {
            if (scannedImport.url === undefined) {
              continue;
            }
            const importUrl = this.resolver.resolve(
                scannedDocument.document.baseUrl,
                scannedImport.url,
                scannedImport);
            if (importUrl === undefined) {
              continue;
            }
            // Request a scan of `importUrl` but do not wait for the results to
            // avoid deadlock in the case of cycles. Later we use the
            // DependencyGraph to wait for all transitive dependencies to load.
            this.scan(importUrl, cancelToken)
                .then((result) => {
                  if (result.successful === true) {
                    return;
                  }
                  scannedImport.error = result.error;
                })
                .catch((e) => {
                  if (isCancel(e)) {
                    return;
                  }
                  throw e;
                });
          }
          await this._cache.dependencyGraph.whenReady(resolvedUrl);
          return scannedDocumentResult;
        }, cancelToken);
  }

  /**
   * Scans a ParsedDocument.
   */
  private async _scanDocument(
      document: ParsedDocument, maybeAttachedComment?: string,
      maybeContainingDocument?: ParsedDocument): Promise<ScannedDocument> {
    const {features: scannedFeatures, warnings} =
        await this._getScannedFeatures(document);
    // If there's an HTML comment that applies to this document then we assume
    // that it applies to the first feature.
    const firstScannedFeature = scannedFeatures[0];
    if (firstScannedFeature && firstScannedFeature instanceof ScannedElement) {
      firstScannedFeature.applyHtmlComment(
          maybeAttachedComment, maybeContainingDocument);
    }

    const scannedDocument =
        new ScannedDocument(document, scannedFeatures, warnings);

    if (!scannedDocument.isInline) {
      if (this._cache.scannedDocuments.has(scannedDocument.url)) {
        throw new Error(
            'Scanned document already in cache. This should never happen.');
      }
      this._cache.scannedDocuments.set(scannedDocument.url, scannedDocument);
    }
    await this._scanInlineDocuments(scannedDocument);
    return scannedDocument;
  }

  private async _getScannedFeatures(document: ParsedDocument) {
    const scanners = this._scanners.get(document.type);
    if (scanners) {
      try {
        return await scan(document, scanners);
      } catch (e) {
        if (e instanceof WarningCarryingException) {
          throw e;
        }
        const message = e == null ? `Unknown error while scanning.` :
                                    `Error while scanning: ${String(e)}`;
        throw new WarningCarryingException(new Warning({
          code: 'internal-scanning-error',
          message,
          parsedDocument: document,
          severity: Severity.ERROR,
          sourceRange: {
            file: document.url,
            start: {column: 0, line: 0},
            end: {column: 0, line: 0},
          }
        }));
      }
    }
    return {features: [], warnings: []};
  }

  private async _scanInlineDocuments(containingDocument: ScannedDocument) {
    for (const feature of containingDocument.features) {
      if (!(feature instanceof ScannedInlineDocument)) {
        continue;
      }
      const locationOffset: LocationOffset = {
        line: feature.locationOffset.line,
        col: feature.locationOffset.col,
        filename: containingDocument.url
      };
      try {
        const parsedDoc = this._parseContents(
            feature.type, feature.contents, containingDocument.url, {
              locationOffset,
              astNode: feature.astNode,
              baseUrl: containingDocument.document.baseUrl
            });
        const scannedDoc = await this._scanDocument(
            parsedDoc, feature.attachedComment, containingDocument.document);

        feature.scannedDocument = scannedDoc;
      } catch (err) {
        if (err instanceof WarningCarryingException) {
          containingDocument.warnings.push(err.warning);
          continue;
        }
        throw err;
      }
    }
  }

  /**
   * Returns `true` if the provided resolved URL can be loaded.  Obeys the
   * semantics defined by `UrlLoader` and should only be used to check
   * resolved URLs.
   */
  canLoad(resolvedUrl: ResolvedUrl): boolean {
    return this.loader.canLoad(resolvedUrl);
  }

  /**
   * Loads the content at the provided resolved URL.  Obeys the semantics
   * defined by `UrlLoader` and should only be used to attempt to load resolved
   * URLs.
   *
   * Currently does no caching. If the provided contents are given then they
   * are used instead of hitting the UrlLoader (e.g. when you have in-memory
   * contents that should override disk).
   */
  async load(resolvedUrl: ResolvedUrl): Promise<Result<string, string>> {
    if (!this.canLoad(resolvedUrl)) {
      return {
        successful: false,
        error: `Configured URL Loader can not load URL ${resolvedUrl}`
      };
    }
    try {
      const value = await this.loader.load(resolvedUrl);
      return {successful: true, value};
    } catch (e) {
      const message = (e && e.message) || `Unknown failure while loading.`;
      return {successful: false, error: message};
    }
  }

  /**
   * Caching + loading wrapper around _parseContents.
   */
  private async _parse(
      resolvedUrl: ResolvedUrl, cancelToken: MinimalCancelToken):
      Promise<Result<ParsedDocument, Warning>> {
    return this._cache.parsedDocumentPromises.getOrCompute(
        resolvedUrl, async () => {
          const result = await this.load(resolvedUrl);
          if (!result.successful) {
            return {
              successful: false,
              error: new Warning({
                code: 'could-not-load',
                parsedDocument: new UnparsableParsedDocument(resolvedUrl, ''),
                severity: Severity.ERROR,
                sourceRange: {
                  file: resolvedUrl,
                  start: {column: 0, line: 0},
                  end: {column: 0, line: 0}
                },
                message: result.error
              })
            };
          }
          const extension = path.extname(resolvedUrl).substring(1);
          try {
            const parsedDoc =
                this._parseContents(extension, result.value, resolvedUrl);
            return {successful: true, value: parsedDoc};
          } catch (e) {
            if (e instanceof WarningCarryingException) {
              return {successful: false, error: e.warning};
            }
            const message = (e && e.message) || `Unknown error while parsing.`;
            return {
              successful: false,
              error: new Warning({
                code: 'could-not-parse',
                parsedDocument:
                    new UnparsableParsedDocument(resolvedUrl, result.value),
                severity: Severity.ERROR,
                sourceRange: {
                  file: resolvedUrl,
                  start: {column: 0, line: 0},
                  end: {column: 0, line: 0}
                },
                message
              })
            };
          }
        }, cancelToken);
  }

  /**
   * Parse the given string into the Abstract Syntax Tree (AST) corresponding
   * to its type.
   */
  private _parseContents(
      type: string, contents: string, url: ResolvedUrl,
      inlineInfo?: InlineDocInfo): ParsedDocument {
    const parser = this.parsers.get(type);
    if (parser == null) {
      throw new NoKnownParserError(`No parser for for file type ${type}`);
    }
    try {
      return parser.parse(contents, url, this.resolver, inlineInfo);
    } catch (error) {
      if (error instanceof WarningCarryingException) {
        throw error;
      }
      const parsedDocument = new UnparsableParsedDocument(url, contents);
      const message = error == null ? `Unable to parse as ${type}` :
                                      `Unable to parse as ${type}: ${error}`;
      throw new WarningCarryingException(new Warning({
        parsedDocument,
        code: 'parse-error',
        message,
        severity: Severity.ERROR,
        sourceRange:
            {file: url, start: {line: 0, column: 0}, end: {line: 0, column: 0}}
      }));
    }
  }

  /**
   * Resolves all resolvable URLs in the list, removes unresolvable ones.
   */
  resolveUserInputUrls(urls: PackageRelativeUrl[]): ResolvedUrl[] {
    return filterOutUndefineds(urls.map((u) => this.resolver.resolve(u)));
  }
}

function filterOutUndefineds<T>(arr: ReadonlyArray<T|undefined>): T[] {
  return arr.filter((t) => t !== undefined) as T[];
}

/**
 * A warning for a weird situation that should never happen.
 *
 * Before calling getDocument(), which is synchronous, a caller must first
 * have finished loading and scanning, as those phases are asynchronous.
 *
 * So we need to construct a warning, but we don't have a parsed document,
 * so we construct this weird fake one. This is such a rare case that it's
 * worth going out of our way here so that warnings can uniformly expect to
 * have documents.
 */
function makeRequestedWithoutLoadingWarning(resolvedUrl: ResolvedUrl) {
  const parsedDocument = new UnparsableParsedDocument(resolvedUrl, '');
  return new Warning({
    sourceRange: {
      file: resolvedUrl,
      start: {line: 0, column: 0},
      end: {line: 0, column: 0}
    },
    code: 'unable-to-analyze',
    message: `[Internal Error] Document was requested ` +
        `before loading and scanning finished. This usually indicates an ` +
        `anomalous error during loading or analysis. Please file a bug at ` +
        `https://github.com/Polymer/polymer-analyzer/issues/new with info ` +
        `on the source code that caused this. ` +
        `Polymer Analyzer version: ${analyzerVersion}`,
    severity: Severity.ERROR,
    parsedDocument
  });
}
