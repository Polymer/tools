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

import {Analysis, Document, ParsedHtmlDocument} from 'polymer-analyzer';

import {ConversionSettings} from './conversion-settings';
import {DocumentConverter} from './document-converter';
import {ConversionResult} from './js-module';
import {ProjectScanner} from './project-scanner';
import {ConvertedDocumentFilePath, OriginalDocumentUrl} from './urls/types';
import {UrlHandler} from './urls/url-handler';

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
 */
export class ProjectConverter {
  private readonly urlHandler: UrlHandler;
  private readonly conversionSettings: ConversionSettings;
  private readonly scanner: ProjectScanner;

  /**
   * A cache of all converted documents. Document conversions should be
   * idempotent, so conversion results can be safely cached.
   */
  private readonly results = new Map<OriginalDocumentUrl, ConversionResult>();

  constructor(
      analysis: Analysis, urlHandler: UrlHandler,
      conversionSettings: ConversionSettings) {
    this.urlHandler = urlHandler;
    this.conversionSettings = conversionSettings;
    this.scanner = new ProjectScanner(analysis, urlHandler, conversionSettings);
  }

  /**
   * Convert a package and any of its dependencies.
   */
  async convertPackage(packageName: string) {
    // First, scan the package (and any of its dependencies)
    await this.scanner.scanPackage(packageName);
    // Then, convert each document in the given package
    for (const document of await this.scanner.getPackageHtmlDocuments(
             packageName)) {
      this.convertDocument(document, packageName);
    }
  }

  /**
   * Get a package manifest (a serializable version of the scanner results) for
   * a package.
   */
  async getConversionManifest(packageName: string) {
    return this.scanner.getConversionManifest(packageName);
  }

  /**
   * Convert a document. The output format (JS Module or HTML Document) is
   * dictated by the results of the scanner.
   */
  private convertDocument(
      document: Document<ParsedHtmlDocument>, packageName: string) {
    console.assert(
        document.kinds.has('html-document'),
        `convertDocument() must be called with an HTML document, but got ${
            document.kinds}`);

    const scanResults = this.scanner.getResults();
    const documentUrl = this.urlHandler.getDocumentUrl(document);
    const scanResult = scanResults.files.get(documentUrl);
    if (!scanResult) {
      throw new Error(`File not found during scan: ${documentUrl}`);
    }

    const documentConverter = new DocumentConverter(
        document, packageName, this.urlHandler, this.conversionSettings);
    if (scanResult.type === 'js-module') {
      documentConverter.convertJsModule(scanResults.exports)
          .forEach((newModule) => {
            this.results.set(newModule.originalUrl, newModule);
          });
    } else if (scanResult.type === 'html-document') {
      const newModule =
          documentConverter.convertTopLevelHtmlDocument(scanResults.exports);
      this.results.set(newModule.originalUrl, newModule);
    } else if (scanResult.type === 'delete-file') {
      const newModule = documentConverter.createDeleteResult();
      this.results.set(newModule.originalUrl, newModule);
    }
  }

  /**
   * This method collects the results after all documents are converted. It
   * handles any broken edge-cases and sets empty map entries for files to be
   * deleted.
   */
  getResults(): Map<ConvertedDocumentFilePath, string|undefined> {
    const results = new Map<ConvertedDocumentFilePath, string|undefined>();

    for (const convertedModule of this.results.values()) {
      // TODO(fks): This is hacky, ProjectConverter isn't supposed to know about
      //  project layout / file location. Move into URLHandler, potentially make
      //  its own `excludes`-like settings option.
      if (excludeFromResults.has(convertedModule.convertedFilePath)) {
        continue;
      }
      if (convertedModule.deleteOriginal) {
        results.set(
            convertedModule.originalUrl as string as ConvertedDocumentFilePath,
            undefined);
      }
      if (convertedModule.output !== undefined) {
        results.set(convertedModule.convertedFilePath, convertedModule.output);
      }
    }
    return results;
  }
}
