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
import * as urlLib from 'url';

import {Analysis} from './analysis';
import {Descriptor, DocumentDescriptor, ImportDescriptor, InlineDocumentDescriptor, LocationOffset} from './ast/ast';
import {CssParser} from './css/css-parser';
import {EntityFinder} from './entity/entity-finder';
import {findEntities} from './entity/find-entities';
import {HtmlDocument} from './html/html-document';
import {HtmlImportFinder} from './html/html-import-finder';
import {HtmlParser} from './html/html-parser';
import {HtmlScriptFinder} from './html/html-script-finder';
import {HtmlStyleFinder} from './html/html-style-finder';
import {JavaScriptParser} from './javascript/javascript-parser';
import {JsonParser} from './json/json-parser';
import {Document} from './parser/document';
import {Parser} from './parser/parser';
import {BehaviorFinder} from './polymer/behavior-finder';
import {PolymerElementFinder} from './polymer/polymer-element-finder';
import {UrlLoader} from './url-loader/url-loader';

export interface Options {
  urlLoader: UrlLoader;
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
    ['html', new HtmlParser(this)],
    ['js', new JavaScriptParser()],
    ['css', new CssParser(this)],
    ['json', new JsonParser()],
  ]);

  private _entityFinders = new Map<string, EntityFinder<any, any, any>[]>([
    [
      'html',
      [new HtmlImportFinder(), new HtmlScriptFinder(), new HtmlStyleFinder()]
    ],
    ['js', [new PolymerElementFinder(), new BehaviorFinder()]],
  ]);

  private _loader: UrlLoader;
  private _documents = new Map<string, Promise<Document<any, any>>>();
  private _documentDescriptors = new Map<string, Promise<DocumentDescriptor>>();

  constructor(options: Options) {
    this._loader = options.urlLoader;
    this._parsers = options.parsers || this._parsers;
    this._entityFinders = options.entityFinders || this._entityFinders;
  }

  /**
   * Loads, parses and analyzes a document and its transitive dependencies.
   *
   * @param {string} url the location of the file to analyze
   * @return {Promise<DocumentDescriptor>}
   */
  async analyze(url: string): Promise<DocumentDescriptor> {
    const cachedResult = this._documentDescriptors.get(url);
    if (cachedResult) {
      return cachedResult;
    }
    const promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise can be cached.
      await Promise.resolve();
      const document = await this.load(url);
      return this._analyzeDocument(document);
    })();
    this._documentDescriptors.set(url, promise);
    return promise;
  }

  async resolve(): Promise<Analysis> {
    return new Analysis(await Promise.all(this._documentDescriptors.values()));
  }

  /**
   * Parses and analyzes a document from source.
   */
  private async _analyzeSource(
      type: string, contents: string, url: string,
      locationOffset?: LocationOffset): Promise<DocumentDescriptor> {
    let document = this.parse(type, contents, url);
    return await this._analyzeDocument(document, locationOffset);
  }

  /**
   * Analyzes a parsed Document object.
   */
  private async _analyzeDocument(
      document: Document<any, any>,
      locationOffset?: LocationOffset): Promise<DocumentDescriptor> {
    let entities = await this.getEntities(document);

    let dependencyDescriptors: Descriptor[] = entities.filter(
        (e) => e instanceof InlineDocumentDescriptor ||
            e instanceof ImportDescriptor);
    let analyzeDependencies = dependencyDescriptors.map((d) => {
      if (d instanceof InlineDocumentDescriptor) {
        return this._analyzeSource(
            d.type, d.contents, document.url, d.locationOffset);
      } else if (d instanceof ImportDescriptor) {
        return this.analyze(d.url);
      } else {
        throw new Error(`Unexpected dependency type: ${d}`);
      }
    });

    let dependencies = await Promise.all(analyzeDependencies);

    return new DocumentDescriptor(
        document, dependencies, entities, locationOffset);
  }

  /**
   * Loads and parses a single file, deduplicating any requrests for the same
   * URL.
   */
  async load(url: string): Promise<Document<any, any>> {
    // TODO(justinfagnani): normalize url
    const cachedResult = this._documents.get(url);
    if (cachedResult) {
      return cachedResult;
    }
    if (!this._loader.canLoad(url)) {
      throw new Error(`Can't load URL: ${url}`);
    }
    // Use an immediately executed async function to create the final Promise
    // synchronously so we can store it in this._documents before any other
    // async operations to avoid any race conditions.
    let promise = (async() => {
      // Make sure we wait and return a Promise before doing any work, so that
      // the Promise can be cached.
      await Promise.resolve();
      let content = await this._loader.load(url);
      let extension = path.extname(url).substring(1);
      return this.parse(extension, content, url);
    })();
    this._documents.set(url, promise);
    return promise;
  }

  parse(type: string, contents: string, url: string): Document<any, any> {
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

  async getEntities(document: Document<any, any>): Promise<Descriptor[]> {
    let finders = this._entityFinders.get(document.type);
    if (finders) {
      return findEntities(document, finders);
    }
    return [];
  }
}
