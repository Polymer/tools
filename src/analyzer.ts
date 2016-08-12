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

import {Document, InlineParsedDocument, LocationOffset, ScannedDocument, ScannedElement, ScannedFeature, ScannedImport} from './ast/ast';
import {CssParser} from './css/css-parser';
import {EntityFinder} from './entity/entity-finder';
import {findEntities} from './entity/find-entities';
import {HtmlImportFinder} from './html/html-import-finder';
import {HtmlParser} from './html/html-parser';
import {HtmlScriptFinder} from './html/html-script-finder';
import {HtmlStyleFinder} from './html/html-style-finder';
import {JavaScriptParser} from './javascript/javascript-parser';
import {JsonParser} from './json/json-parser';
import {ParsedDocument} from './parser/document';
import {Parser} from './parser/parser';
import {BehaviorFinder} from './polymer/behavior-finder';
import {DomModuleFinder} from './polymer/dom-module-finder';
import {PolymerElementFinder} from './polymer/polymer-element-finder';
import {UrlLoader} from './url-loader/url-loader';
import {UrlResolver} from './url-loader/url-resolver';
import {ElementFinder as VanillaElementFinder} from './vanilla-custom-elements/element-finder';

export interface Options {
  urlLoader: UrlLoader;
  urlResolver?: UrlResolver;
  parsers?: Map<string, Parser<any>>;
  entityFinders?: Map<string, EntityFinder<any, any, any>[]>;
}

/**
 * A static analyzer for web projects.
 *
 * An Analyzer can load and parse documents of various types, and extract
 * arbitratrary information from the documents, and transitively load
 * dependencies. An Analyzer instance is configured with parsers, and entity
 * finders which do the actual work of understanding different file types.
 */
export class Analyzer {
  private _parsers: Map<string, Parser<any>> = new Map<string, Parser<any>>([
    ['html', new HtmlParser()],
    ['js', new JavaScriptParser()],
    ['css', new CssParser()],
    ['json', new JsonParser()],
  ]);

  private _entityFinders = new Map<string, EntityFinder<any, any, any>[]>([
    [
      'html',
      [
        new HtmlImportFinder(), new HtmlScriptFinder(), new HtmlStyleFinder(),
        new DomModuleFinder()
      ]
    ],
    [
      'js',
      [
        new PolymerElementFinder(), new BehaviorFinder(),
        new VanillaElementFinder()
      ]
    ],
  ]);

  private _loader: UrlLoader;
  private _resolver: UrlResolver|undefined;
  private _parsedDocuments =
      new Map<string, Promise<ParsedDocument<any, any>>>();
  private _scannedDocuments = new Map<string, Promise<ScannedDocument>>();

  constructor(options: Options) {
    this._loader = options.urlLoader;
    this._resolver = options.urlResolver;
    this._parsers = options.parsers || this._parsers;
    this._entityFinders = options.entityFinders || this._entityFinders;
  }

  /**
   * Loads, parses and analyzes a document and its transitive dependencies.
   */
  async analyze(url: string): Promise<Document> {
    const scannedDocument = await this._analyzeResolved(this._resolveUrl(url));
    return Document.makeRootDocument(scannedDocument);
  }

  /**
   * Like `analyze`, but for use cases like editors where the caller believes
   * the file has changed since the last time it was analyzed, and you may
   * even have unsaved in-memory contents to use for the given file.
   */
  async analyzeChangedFile(url: string, contents?: string): Promise<Document> {
    const resolved = this._resolveUrl(url);
    this._scannedDocuments.delete(resolved);
    this._parsedDocuments.delete(resolved);
    const scannedDocument =
        await this._analyzeResolved(this._resolveUrl(url), contents);
    return Document.makeRootDocument(scannedDocument);
  }

  private async _analyzeResolved(resolvedUrl: string, contents?: string):
      Promise<ScannedDocument> {
    let cachedResult = this._scannedDocuments.get(resolvedUrl);
    if (cachedResult) {
      return cachedResult;
    }
    let promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise is cached before anything else happens.
      await Promise.resolve();
      let document = await this._loadResolved(resolvedUrl, contents);
      return this._analyzeDocument(document);
    })();
    this._scannedDocuments.set(resolvedUrl, promise);
    return promise;
  }

  private async _resolve(url: string): Promise<ScannedDocument> {
    return this._analyzeResolved(this._resolveUrl(url));
  }

  /**
   * Parses and analyzes a document from source.
   */
  private async _analyzeSource(
      type: string, contents: string, url: string,
      locationOffset?: LocationOffset,
      attachedComment?: string): Promise<ScannedDocument> {
    let resolvedUrl = this._resolveUrl(url);
    let document = this._parse(type, contents, resolvedUrl);
    return await this._analyzeDocument(
        document, locationOffset, attachedComment);
  }

  /**
   * Analyzes a parsed Document object.
   */
  private async _analyzeDocument(
      document: ParsedDocument<any, any>, maybeLocationOffset?: LocationOffset,
      maybeAttachedComment?: string): Promise<ScannedDocument> {
    const locationOffset =
        maybeLocationOffset || {line: 0, col: 0, filename: document.url};
    let entities = await this._getEntities(document);
    for (const entity of entities) {
      if (entity instanceof ScannedElement) {
        entity.applyLocationOffset(locationOffset);
      }
    }
    // If there's an HTML comment that applies to this document then we assume
    // that it applies to the first entity.
    const firstEntity = entities[0];
    if (firstEntity && firstEntity instanceof ScannedElement) {
      firstEntity.applyHtmlComment(maybeAttachedComment);
    }

    let scannedDependencies: ScannedFeature[] = entities.filter(
        (e) => e instanceof InlineParsedDocument || e instanceof ScannedImport);
    let analyzeDependencies =
        scannedDependencies.map(async(scannedDependency) => {
          if (scannedDependency instanceof InlineParsedDocument) {
            const locationOffset: LocationOffset = {
              line: scannedDependency.locationOffset.line,
              col: scannedDependency.locationOffset.col,
              filename: document.url
            };
            const scannedDocument = await this._analyzeSource(
                scannedDependency.type, scannedDependency.contents,
                document.url, locationOffset,
                scannedDependency.attachedComment);
            scannedDependency.scannedDocument = scannedDocument;
            scannedDependency.scannedDocument.isInline = true;
            return scannedDocument;
          } else if (scannedDependency instanceof ScannedImport) {
            const scannedDocument = await this._resolve(scannedDependency.url);
            scannedDependency.scannedDocument = scannedDocument;
            return scannedDocument;
          } else {
            throw new Error(`Unexpected dependency type: ${scannedDependency}`);
          }
        });

    let dependencies = await Promise.all(analyzeDependencies);

    return new ScannedDocument(
        document, dependencies, entities, locationOffset);
  }

  private async _loadResolved(resolvedUrl: string, providedContents?: string):
      Promise<ParsedDocument<any, any>> {
    const cachedResult = this._parsedDocuments.get(resolvedUrl);
    if (cachedResult) {
      return cachedResult;
    }
    if (!this._loader.canLoad(resolvedUrl)) {
      throw new Error(`Can't load URL: ${resolvedUrl}`);
    }
    // Use an immediately executed async function to create the final Promise
    // synchronously so we can store it in this._documents before any other
    // async operations to avoid any race conditions.
    let promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise can be cached.
      await Promise.resolve();
      let content = providedContents == null ?
          await this._loader.load(resolvedUrl) :
          providedContents;
      let extension = path.extname(resolvedUrl).substring(1);
      return this._parse(extension, content, resolvedUrl);
    })();
    this._parsedDocuments.set(resolvedUrl, promise);
    return promise;
  }

  private _parse(type: string, contents: string, url: string):
      ParsedDocument<any, any> {
    let parser = this._parsers.get(type);
    if (parser == null) {
      throw new Error(`No parser for for file type ${type}`);
    }
    try {
      return parser.parse(contents, url);
    } catch (error) {
      throw new Error(`Error parsing ${url}:\n ${error.stack}`);
    }
  }

  private async _getEntities(document: ParsedDocument<any, any>):
      Promise<ScannedFeature[]> {
    let finders = this._entityFinders.get(document.type);
    if (finders) {
      return findEntities(document, finders);
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
