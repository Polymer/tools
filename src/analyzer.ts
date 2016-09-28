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

import * as path from 'path';

import {CssParser} from './css/css-parser';
import {HtmlImportScanner} from './html/html-import-scanner';
import {HtmlParser} from './html/html-parser';
import {HtmlScriptScanner} from './html/html-script-scanner';
import {HtmlStyleScanner} from './html/html-style-scanner';
import {JavaScriptParser} from './javascript/javascript-parser';
import {JsonParser} from './json/json-parser';
import {correctSourceRange, Document, LocationOffset, ScannedDocument, ScannedElement, ScannedFeature, ScannedImport, ScannedInlineDocument} from './model/model';
import {ParsedDocument} from './parser/document';
import {Parser} from './parser/parser';
import {Measurement, TelemetryTracker} from './perf/telemetry';
import {BehaviorScanner} from './polymer/behavior-scanner';
import {CssImportScanner} from './polymer/css-import-scanner';
import {DomModuleScanner} from './polymer/dom-module-scanner';
import {PolymerElementScanner} from './polymer/polymer-element-scanner';
import {scan} from './scanning/scan';
import {Scanner} from './scanning/scanner';
import {UrlLoader} from './url-loader/url-loader';
import {UrlResolver} from './url-loader/url-resolver';
import {ElementScanner as VanillaElementScanner} from './vanilla-custom-elements/element-scanner';
import {Severity, Warning, WarningCarryingException} from './warning/warning';

export interface Options {
  urlLoader: UrlLoader;
  urlResolver?: UrlResolver;
  parsers?: Map<string, Parser<any>>;
  scanners?: Map<string, Scanner<any, any, any>[]>;
}

export class NoKnownParserError extends Error {};

/**
 * A static analyzer for web projects.
 *
 * An Analyzer can load and parse documents of various types, and extract
 * arbitratrary information from the documents, and transitively load
 * dependencies. An Analyzer instance is configured with parsers, and scanners
 * which do the actual work of understanding different file types.
 */
export class Analyzer {
  private _parsers = new Map<string, Parser<ParsedDocument<any, any>>>([
    ['html', new HtmlParser()],
    ['js', new JavaScriptParser({sourceType: 'script'})],
    ['css', new CssParser()],
    ['json', new JsonParser()],
  ]);

  private scanners = new Map<string, Scanner<any, any, any>[]>([
    [
      'html',
      [
        new HtmlImportScanner(), new HtmlScriptScanner(),
        new HtmlStyleScanner(), new DomModuleScanner(), new CssImportScanner()
      ]
    ],
    [
      'js',
      [
        new PolymerElementScanner(), new BehaviorScanner(),
        new VanillaElementScanner()
      ]
    ],
  ]);

  private _loader: UrlLoader;
  private _resolver: UrlResolver|undefined;

  private _parsedDocumentPromises =
      new Map<string, Promise<ParsedDocument<any, any>>>();
  private _scannedDocumentPromises =
      new Map<string, Promise<ScannedDocument>>();
  private _analyzedDocumentPromises = new Map<string, Promise<Document>>();

  private _scannedDocuments = new Map<string, ScannedDocument>();
  private _analyzedDocuments = new Map<string, Document>();

  private _telemetryTracker = new TelemetryTracker();

  constructor(options: Options) {
    this._loader = options.urlLoader;
    this._resolver = options.urlResolver;
    this._parsers = options.parsers || this._parsers;
    this.scanners = options.scanners || this.scanners;
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
    const resolvedUrl = this._resolveUrl(url);

    // if we're given new contents, clear the cache
    // TODO(justinfagnani): It might be better to preserve a single code path
    // for loading file contents via UrlLoaders, and just offer a method to
    // re-analyze a particular file. Editors can use a UrlLoader that reads from
    // it's internal buffers.
    if (contents != null) {
      this._scannedDocumentPromises.delete(resolvedUrl);
      this._scannedDocuments.delete(resolvedUrl);
      this._parsedDocumentPromises.delete(resolvedUrl);
      this._analyzedDocuments.delete(resolvedUrl);
      this._analyzedDocumentPromises.delete(resolvedUrl);
    }

    const cachedResult = this._analyzedDocumentPromises.get(resolvedUrl);
    if (cachedResult) {
      return cachedResult;
    }
    // TODO(justinfagnani): also check _analyzedDocuments?

    const promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise is cached before anything else happens.
      await Promise.resolve();
      const doneTiming =
          this._telemetryTracker.start('analyze: make document', url);
      const scannedDocument = await this._scan(resolvedUrl, contents);
      const document = this._makeDocument(scannedDocument);
      doneTiming();
      return document;
    })();
    this._analyzedDocumentPromises.set(resolvedUrl, promise);
    return promise;
  }

  /**
   * Constructs a new analyzed Document and adds it to the analyzed Document
   * cache.
   */
  private _makeDocument(scannedDocument: ScannedDocument): Document {
    if (this._analyzedDocuments.has(scannedDocument.url)) {
      throw new Error(
          `Internal error: document ${scannedDocument.url} already exists`);
    }
    const document = new Document(scannedDocument, this);
    document.resolve();
    // TODO(justinfagnani): should this add to _analyzedDocumentPromises?
    this._analyzedDocuments.set(scannedDocument.url, document);
    return document;
  }

  /**
   * Gets an analyzed Document from the document cache. This is only useful for
   * Analyzer plugins. You almost certainly want to use `analyze()` instead.
   *
   * If a document has been analyzed, it returns the analyzed Document. If not
   * the scanned document cache is used and a new analyzed Document is returned.
   * If a file is in neither cache, it returns `null`.
   */
  _getDocument(url: string): Document {
    const resolvedUrl = this._resolveUrl(url);
    let document = this._analyzedDocuments.get(resolvedUrl);
    if (document) {
      return document;
    }
    const scannedDocument = this._scannedDocuments.get(resolvedUrl);
    return scannedDocument && this._makeDocument(scannedDocument);
  }

  async getTelemetryMeasurements(): Promise<Measurement[]> {
    return this._telemetryTracker.getMeasurements();
  }

  /**
   * Clear all cached information from this analyzer instance.
   *
   * Note: if at all possible, instead tell the analyzer about the specific
   * files that changed rather than clearing caches like this. Caching provides
   * large performance gains.
   */
  clearCaches(): void {
    this._scannedDocumentPromises.clear();
    this._scannedDocuments.clear();
    this._parsedDocumentPromises.clear();
    this._analyzedDocuments.clear();
    this._analyzedDocumentPromises.clear();
  }

  private async _scan(resolvedUrl: string, contents?: string):
      Promise<ScannedDocument> {
    const cachedResult = this._scannedDocumentPromises.get(resolvedUrl);
    if (cachedResult) {
      return cachedResult;
    }
    const promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise is cached before anything else happens.
      await Promise.resolve();
      const document = await this._parse(resolvedUrl, contents);
      return this._scanDocument(document);
    })();
    this._scannedDocumentPromises.set(resolvedUrl, promise);
    return promise;
  }

  /**
   * Parses and scans a document from source.
   */
  private async _scanSource(
      type: string, contents: string, url: string,
      locationOffset?: LocationOffset,
      attachedComment?: string): Promise<ScannedDocument> {
    const resolvedUrl = this._resolveUrl(url);
    const document =
        this._parseContents(type, contents, resolvedUrl, locationOffset);
    return await this._scanDocument(document, attachedComment);
  }

  /**
   * Scans a parsed Document object.
   */
  private async _scanDocument(
      document: ParsedDocument<any, any>, maybeAttachedComment?: string): Promise<ScannedDocument> {
    // TODO(rictic): We shouldn't be calling _scanDocument with
    // null/undefined.
    if (document == null) {
      return null;
    }
    const warnings: Warning[] = [];
    const scannedFeatures = await this._getScannedFeatures(document);
    // If there's an HTML comment that applies to this document then we assume
    // that it applies to the first feature.
    const firstScannedFeature = scannedFeatures[0];
    if (firstScannedFeature && firstScannedFeature instanceof ScannedElement) {
      firstScannedFeature.applyHtmlComment(maybeAttachedComment);
    }

    const scannedDependencies: ScannedFeature[] = scannedFeatures.filter(
        (e) =>
            e instanceof ScannedInlineDocument || e instanceof ScannedImport);
    const scannedSubDocuments =
        scannedDependencies.map(async(scannedDependency) => {
          if (scannedDependency instanceof ScannedInlineDocument) {
            return this._scanInlineDocument(
                scannedDependency, document, warnings);
          } else if (scannedDependency instanceof ScannedImport) {
            return this._scanImport(scannedDependency, warnings);
          } else {
            throw new Error(`Unexpected dependency type: ${scannedDependency}`);
          }
        });

    const dependencies =
        (await Promise.all(scannedSubDocuments)).filter(s => !!s);

    const scannedDocument = new ScannedDocument(
        document, dependencies, scannedFeatures, warnings);
    this._scannedDocuments.set(scannedDocument.url, scannedDocument);
    return scannedDocument;
  }

  /**
   * Scan an inline document found within a containing parsed doc.
   */
  private async _scanInlineDocument(
      inlineDoc: ScannedInlineDocument,
      containingDocument: ParsedDocument<any, any>,
      warnings: Warning[]): Promise<ScannedDocument|null> {
    const locationOffset: LocationOffset = {
      line: inlineDoc.locationOffset.line,
      col: inlineDoc.locationOffset.col,
      filename: containingDocument.url
    };
    try {
      const scannedDocument = await this._scanSource(
          inlineDoc.type, inlineDoc.contents, containingDocument.url,
          locationOffset, inlineDoc.attachedComment);
      inlineDoc.scannedDocument = scannedDocument;
      inlineDoc.scannedDocument.isInline = true;
      return scannedDocument;
    } catch (err) {
      if (err instanceof WarningCarryingException) {
        const e: WarningCarryingException = err;
        e.warning.sourceRange =
            correctSourceRange(e.warning.sourceRange, locationOffset);
        warnings.push(e.warning);
        return null;
      }
      throw err;
    }
  }

  private async _scanImport(scannedImport: ScannedImport, warnings: Warning[]):
      Promise<ScannedDocument|null> {
    let scannedDocument: ScannedDocument;
    try {
      // HACK(rictic): this isn't quite right either, we need to get
      //     the scanned dependency's url relative to the basedir don't
      //     we?
      scannedDocument = await this._scan(this._resolveUrl(scannedImport.url));
    } catch (error) {
      if (error instanceof NoKnownParserError) {
        // We probably don't want to fail when importing something
        // that we don't know about here.
        return null;
      }
      error = error || '';
      warnings.push({
        code: 'could-not-load',
        message: `Unable to load import: ${error.message || error}`,
        sourceRange: scannedImport.urlSourceRange || scannedImport.sourceRange,
        severity: Severity.ERROR
      });
      return null;
    }
    scannedImport.scannedDocument = scannedDocument;
    return scannedDocument;
  }

  /**
   * Loads the content at the provided resolved URL.
   *
   * Currently does no caching. If the provided contents are given then they
   * are used instead of hitting the UrlLoader (e.g. when you have in-memory
   * contents that should override disk).
   */
  async load(resolvedUrl: string, providedContents?: string) {
    if (!this._loader.canLoad(resolvedUrl)) {
      throw new Error(`Can't load URL: ${resolvedUrl}`);
    }
    return providedContents == null ? await this._loader.load(resolvedUrl) :
                                      providedContents;
  }

  private async _parse(resolvedUrl: string, providedContents?: string):
      Promise<ParsedDocument<any, any>> {
    const cachedResult = this._parsedDocumentPromises.get(resolvedUrl);
    if (cachedResult) {
      return cachedResult;
    }

    // Use an immediately executed async function to create the final Promise
    // synchronously so we can store it in this._documents before any other
    // async operations to avoid any race conditions.
    const promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise can be cached.
      await Promise.resolve();

      const content = await this.load(resolvedUrl, providedContents);
      const extension = path.extname(resolvedUrl).substring(1);

      const doneTiming = this._telemetryTracker.start('parse', 'resolvedUrl');
      const parsedDoc =
          this._parseContents(extension, content, resolvedUrl, null);
      doneTiming();
      return parsedDoc;
    })();
    this._parsedDocumentPromises.set(resolvedUrl, promise);
    return promise;
  }

  private _parseContents(
      type: string, contents: string, url: string,
      locationOffset: LocationOffset|null): ParsedDocument<any, any> {
    const parser = this._parsers.get(type);
    if (parser == null) {
      throw new NoKnownParserError(`No parser for for file type ${type}`);
    }
    try {
      return parser.parse(contents, url, locationOffset);
    } catch (error) {
      if (error instanceof WarningCarryingException) {
        throw error;
      }
      throw new Error(`Error parsing ${url}:\n ${error.stack}`);
    }
  }

  private async _getScannedFeatures(document: ParsedDocument<any, any>):
      Promise<ScannedFeature[]> {
    const scanners = this.scanners.get(document.type);
    if (scanners) {
      return scan(document, scanners);
    }
    return [];
  }

  /**
   * Resolves a URL with this Analyzer's `UrlResolver` if it has one, otherwise
   * returns the given URL.
   */
  private _resolveUrl(url: string): string {
    return this._resolver && this._resolver.canResolve(url) ?
        this._resolver.resolve(url) :
        url;
  }
}
