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

import {Document} from 'polymer-analyzer';

import {ConversionSettings} from './conversion-settings';
import {DocumentConverter} from './document-converter';
import {ConversionResult, JsExport} from './js-module';
import {ConvertedDocumentFilePath, OriginalDocumentUrl} from './urls/types';
import {UrlHandler} from './urls/url-handler';
import {getDocumentUrl} from './urls/util';

// These files were already ES6 modules, so don't write our conversions.
// Can't be handled in `excludes` because we want to preserve imports of.
const excludeFromResults = new Set([
  'shadycss/entrypoints/apply-shim.js',
  'bower_components/shadycss/entrypoints/apply-shim.js',
  'shadycss/entrypoints/custom-style-interface.js',
  'bower_components/shadycss/entrypoints/custom-style-interface.js',
]);

/**
 * ProjectConverter provides the top-level interface for running a project
 * conversion. convertDocument() should be called to kick off any conversion,
 * and getResults() should be called once conversion is complete.
 *
 * For best results, only one ProjectConverter instance should be needed, so
 * that it can cache results and avoid duplicate, extraneous document
 * conversions.
 *
 * ProjectConverter is indifferent to the layout of the project, delegating any
 * special URL handling/resolution to the urlHandler provided to the
 * constructor.
 */
export class ProjectConverter {
  readonly urlHandler: UrlHandler;
  readonly conversionSettings: ConversionSettings;

  /**
   * A cache of all JS Exports by namespace, to map implicit HTML imports to
   * explicit named JS imports.
   */
  readonly namespacedExports = new Map<string, JsExport>();

  /**
   * A cache of all converted documents. Document conversions should be
   * idempotent, so conversion results can be safely cached.
   */
  readonly conversionResults = new Map<OriginalDocumentUrl, ConversionResult>();

  constructor(urlHandler: UrlHandler, conversionSettings: ConversionSettings) {
    this.urlHandler = urlHandler;
    this.conversionSettings = conversionSettings;
  }

  /**
   * Convert a document and any of its dependencies. The output format (JS
   * Module or HTML Document) is determined by whether the file is included in
   * conversionSettings.includes.
   */
  convertDocument(document: Document) {
    console.assert(
        document.kinds.has('html-document'),
        `convertDocument() must be called with an HTML document, but got ${
            document.kinds}`);
    try {
      this.conversionSettings.includes.has(document.url) ?
          this.convertDocumentToJs(document, new Set()) :
          this.convertDocumentToHtml(document, new Set());
    } catch (e) {
      console.error(`Error in ${document.url}`, e);
    }
  }

  /**
   * Check if a document is explicitly excluded or has already been converted
   * to decide if it should be converted or skipped.
   */
  shouldConvertDocument(document: Document): boolean {
    const documentUrl = getDocumentUrl(document);
    return !this.conversionResults.has(documentUrl) &&
        !this.conversionSettings.excludes.has(documentUrl);
  }

  /**
   * Convert an HTML document to a JS module. Useful during conversion for
   * dependencies where the type of result is explictly expected.
   */
  convertDocumentToJs(document: Document, visited: Set<OriginalDocumentUrl>) {
    if (!this.shouldConvertDocument(document)) {
      return;
    }
    const documentConverter = new DocumentConverter(this, document, visited);
    const newModule = documentConverter.convertToJsModule();
    this._handleConversionResult(newModule);
  }

  /**
   * Convert an HTML document without changing the file type (changes imports
   * and inline scripts to modules as necessary). Useful during conversion for
   * dependencies where the type of result is explictly expected.
   */
  convertDocumentToHtml(document: Document, visited: Set<OriginalDocumentUrl>) {
    if (!this.shouldConvertDocument(document)) {
      return;
    }
    const documentConverter = new DocumentConverter(this, document, visited);
    const newModule = documentConverter.convertAsToplevelHtmlDocument();
    this._handleConversionResult(newModule);
  }

  /**
   * A private instance method for handling new conversion results, exports,
   * etc.
   */
  private _handleConversionResult(newModule: ConversionResult): void {
    this.conversionResults.set(newModule.originalUrl, newModule);
    if (newModule.output.type === 'js-module') {
      for (const expr of newModule.output.exportedNamespaceMembers) {
        this.namespacedExports.set(
            expr.oldNamespacedName,
            new JsExport(newModule.convertedUrl, expr.es6ExportName));
      }
    }
  }

  /**
   * This method collects the results after all documents are converted. It
   * handles out some broken edge-cases (ex: shadycss) and sets empty map
   * entries for files to be deleted.
   */
  getResults(): Map<ConvertedDocumentFilePath, string|undefined> {
    const results = new Map<ConvertedDocumentFilePath, string|undefined>();

    for (const convertedModule of this.conversionResults.values()) {
      // TODO(fks): This is hacky, ProjectConverter isn't supposed to know about
      //  project layout / file location. Move into URLHandler, potentially make
      //  its own `excludes`-like settings option.
      if (excludeFromResults.has(convertedModule.originalUrl)) {
        continue;
      }
      if (convertedModule.deleteOriginal) {
        results.set(
            convertedModule.originalUrl as string as ConvertedDocumentFilePath,
            undefined);
      }
      results.set(
          convertedModule.convertedFilePath, convertedModule.output.source);
    }

    return results;
  }
}
