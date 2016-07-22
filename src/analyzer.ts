/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as path from 'path';
import * as urlLib from 'url';

import {CssParser} from './css/css-parser';
import {EntityFinder} from './entity/entity-finder';
import {HtmlDocument} from './html/html-document';
import {HtmlImportFinder} from './html/html-import-finder';
import {HtmlParser} from './html/html-parser';
import {HtmlScriptFinder} from './html/html-script-finder';
import {HtmlStyleFinder} from './html/html-style-finder';
import {ElementFinder} from './javascript/javascript-element-finder';
import {JavaScriptParser} from './javascript/javascript-parser';
import {Document} from './parser/document';
import {Parser} from './parser/parser';
import {
  Descriptor,
  DocumentDescriptor,
  ImportDescriptor,
} from './ast/ast';
import {UrlLoader} from './url-loader/url-loader';

export interface AnalyzerInit {
  urlLoader?: UrlLoader;
  parsers?: Map<string, Parser<any>>;
  entityFinders?: Map<string, EntityFinder<any, any, any>[]>;
}

/**
 * A database of Polymer metadata defined in HTML
 */
export class Analyzer {

  private _parsers: Map<string, Parser<any>> = new Map<string, Parser<any>>([
      ['html', new HtmlParser(this)],
      ['js', new JavaScriptParser(this)],
      ['css', new CssParser(this)],
    ]);

  private _entityFinders = new Map<string, EntityFinder<any, any, any>[]>([
        ['html', [new HtmlImportFinder(), new HtmlScriptFinder(this), new HtmlStyleFinder(this)]],
        ['js', [new ElementFinder(this)]],
    ]);

  private _loader: UrlLoader;

  private _documents: Map<string, Promise<Document<any, any>>> = new Map();
  private _documentDescriptors: Map<string, Promise<DocumentDescriptor>> = new Map();

  constructor(from: AnalyzerInit) {
    this._loader = from.urlLoader;
    this._parsers = from.parsers || this._parsers;
    this._entityFinders = from.entityFinders || this._entityFinders;
  }

  /**
   * Loads and analyzes a document and its transitive dependencies.
   *
   * @param {string} url the location of the file to analyze
   * @return {Promise<DocumentDescriptor>}
   */
  async analyze(url: string): Promise<DocumentDescriptor> {
    if (this._documentDescriptors.has(url)) {
      return this._documentDescriptors.get(url);
    }
    let promise = this.analyzeDocument(await this.load(url));
    this._documentDescriptors.set(url, promise);
    return promise;
  }

  async analyzeSource(type: string, contents: string, url: string): Promise<DocumentDescriptor>  {
    let document = this.parse(type, contents, url);
    return this.analyzeDocument(document);
  }

  async analyzeDocument(document: Document<any, any>): Promise<DocumentDescriptor> {
    let entities = await this.getEntities(document);

    // TODO(justinfagnani): Load ImportDescriptors

    return new DocumentDescriptor(document, entities);
  }


  /**
   * Loads and parses a single file, deduplicating any requrests for the same
   * URL.
   */
  async load(url: string): Promise<Document<any, any>> {
    // TODO(justinfagnani): normalize url
    if (this._documents.has(url)) {
      return this._documents.get(url);
    }
    if (!this._loader.canLoad(url)) {
      throw new Error(`Can't load URL: ${url}`);
    }
    // Use an immediately executed async function to create the final Promise
    // synchronously so we can store it in this._documents before any other
    // async operations to avoid any race conditions.
    let promise = (async () => {
      let content = await this._loader.load(url);
      let extension = path.extname(url).substring(1);
      return this.parse(extension, content, url);
    })();
    this._documents.set(url, promise);
    return promise;
  }

  parse(type: string, contents: string, url: string) {
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
    let entities: Descriptor[] = [];

    if (finders) {

      // We batch run visitors passed by findEntities() to its visit argument.
      // Since we need to pass control back to findEnties, we return a Promise
      // when the batch is done. We use an IIAFE (Immediatly Invoked Async
      // Function Expression) to make a Promise resolves and catch exceptions
      // automatically.
      let finderPromises: Promise<Descriptor>[];
      let visitPromise: Promise<void>;
      visitPromise = (async () => {
        let visitors: any = [];
        // Collect visitors and return the batch Promise
        let visit = (visitor: any) => {
          visitors.push(visitor);
          return visitPromise;
        };
        finderPromises = finders.map((f) => f.findEntities(document, visit));
        document.visit(visitors);
        // The Promise will resolve when the function returns
      })();
      await visitPromise;
      entities = entities.concat.apply(entities, await Promise.all(finderPromises));
    }
    return entities;
  }

}
