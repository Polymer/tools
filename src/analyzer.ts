/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as dom5 from 'dom5';
import * as estree from 'estree';
import {ASTNode, LocationInfo} from 'parse5';
import * as path from 'path';
import * as urlLib from 'url';

import * as docs from './ast-utils/docs';
import {CssParser} from './parser/css-parser';
import {HtmlParser, getOwnerDocument} from './parser/html-parser';
import {HtmlDocument} from './parser/html-document';
import {JavaScriptParser} from './parser/javascript-parser';
import {Document} from './parser/document';
import {Parser} from './parser/parser';
import {jsParse} from './ast-utils/js-parse';
import {
  BehaviorDescriptor,
  Descriptor,
  DocumentDescriptor,
  ElementDescriptor,
  FeatureDescriptor,
  ImportDescriptor,
} from './ast/ast';
import {ImportFinder} from './import/import-finder.ts';
import {HtmlImportFinder} from './import/html-import-finder';
import {HtmlScriptFinder} from './import/html-script-finder';
import {UrlLoader} from './url-loader/url-loader';
import {UrlResolver} from './url-loader/url-resolver';

export interface AnalyzerInit {
  urlLoader: UrlLoader;
  importFinders: Map<string, ImportFinder<any>[]>;
  parsers: Map<string, Parser<any>>;
}

/**
 * A database of Polymer metadata defined in HTML
 */
export class Analyzer {
  loader: UrlLoader;

  private _parsers: Map<string, Parser<any>> = new Map();
  private _importFinders: Map<string, ImportFinder<any>[]> = new Map();

  private _documents: Map<string, Promise<Document<any>>> = new Map();
  private _documentDescriptors: Map<string, Promise<DocumentDescriptor>> = new Map();

  static getDefaultImportFinders(): Map<string, ImportFinder<any>[]> {
    let finders = new Map();
    finders.set('html', [new HtmlImportFinder(), new HtmlScriptFinder()]);
    return finders;
  }

  static getDefaultParsers(analyzer: Analyzer): Map<string, Parser<any>> {
    let parsers = new Map();
    parsers.set('html', new HtmlParser(analyzer));
    parsers.set('js', new JavaScriptParser(analyzer));
    parsers.set('css', new CssParser(analyzer));
    return parsers;
  }

  constructor(from: AnalyzerInit) {
    this.loader = from.urlLoader;
    this._parsers = from.parsers || Analyzer.getDefaultParsers(this);
    this._importFinders = from.importFinders || Analyzer.getDefaultImportFinders();
  }


  /**
   * Analyzes a document and its transitive dependencies.
   *
   * @param {string} url the location of the file to analyze
   * @return {Promise<DocumentDescriptor>}
   */
  async analyze(url: string): Promise<DocumentDescriptor> {
    if (this._documentDescriptors.has(url)) {
      return this._documentDescriptors.get(url);
    }

    let promise = (async () => {
      let document = await this.load(url);
      // TODO(justinfagnani): trigger entity finders
      let dependencies = <DocumentDescriptor[]><any>(await Promise.all(
          document.imports.map((i) => this.analyze(i.url))));
      return new DocumentDescriptor(document, dependencies);
    })();
    this._documentDescriptors.set(url, promise);
    return promise;
  };

  /**
   * Loads and parses a single file, deduplicating any requrests for the same
   * URL.
   */
  async load(url: string): Promise<Document<any>> {
    // TODO(justinfagnani): normalize url
    if (this._documents.has(url)) {
      return this._documents.get(url);
    }
    if (!this.loader.canLoad(url)) {
      throw new Error(`Can't load URL: ${url}`);
    }
    // Use an immediately executed async function to create the final Promise
    // synchronously so we can store it in this._documents before any other
    // async operations to avoid any race conditions.
    let promise = (async () => {
      let content = await this.loader.load(url);
      let extension = path.extname(url).substring(1);
      return this.parse(extension, content, url);
    })();
    this._documents.set(url, promise);
    return promise;
  }

  findImports<T>(url: string, document: T): ImportDescriptor[] {
    let extension = path.extname(url).substring(1);
    let finders: ImportFinder<T>[] = this._importFinders.get(extension);
    if (finders == null) {
      throw new Error(`No ImportFinders for extension ${extension}`);
    }
    let imports: ImportDescriptor[] = [];
    for (let finder of finders) {
      imports = imports.concat(finder.findImports(url, document));
    }
    return imports;
  }

  parse(type: string, content: string, url: string) {
    let parser = this._parsers.get(type);
    if (parser == null) {
      throw new Error(`No parser for for file type ${type}`);
    }
    try {
      return parser.parse(content, url);
    } catch (error) {
      throw new Error(`Error parsing ${url}:\n ${error.stack}`);
    }
  }

}
