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

import {Analysis, Document} from 'polymer-analyzer';

import {ConversionSettings} from './conversion-settings';
import {DeleteFileScanResult, DocumentConverter, HtmlDocumentScanResult, JsModuleScanResult} from './document-converter';
import {JsExport} from './js-module';
import {OriginalDocumentUrl} from './urls/types';
import {UrlHandler} from './urls/url-handler';

/**
 * ProjectScanner provides the top-level interface for scanning packages and
 * their dependencies. Scanning packages allows us to detect the new ES Module
 * external interface(s) across a project so that we can properly rewrite and
 * convert our files.
 *
 * For best results, only one ProjectScanner instance should be needed, so
 * that it can cache results and avoid duplicate, extraneous document
 * conversions.
 *
 * ProjectScanner is indifferent to the layout of the project, delegating any
 * special URL handling/resolution to the urlHandler provided to the
 * constructor.
 */
export class ProjectScanner {
  private readonly analysis: Analysis;
  private readonly urlHandler: UrlHandler;
  private readonly conversionSettings: ConversionSettings;

  private readonly scannedPackages = new Set<string>();

  /**
   * All JS Exports registered by namespaced identifier, to map implicit HTML
   * imports to explicit named JS imports.
   */
  private readonly namespacedExports = new Map<string, JsExport>();

  /**
   * All Scan Results registered by document URL, so that the conversion process
   * knows how to treat each file.
   */
  private readonly results = new Map<
      OriginalDocumentUrl,
      JsModuleScanResult|DeleteFileScanResult|HtmlDocumentScanResult>();

  constructor(
      analysis: Analysis, urlHandler: UrlHandler,
      conversionSettings: ConversionSettings) {
    this.analysis = analysis;
    this.urlHandler = urlHandler;
    this.conversionSettings = conversionSettings;
  }

  /**
   * Get all relevant HTML documents from a package that should be scanned,
   * coverted, or otherwise handled by the modulizer.
   */
  getPackageDocuments(matchPackageName: string) {
    return [
      ...this.analysis.getFeatures(
          {kind: 'html-document', externalPackages: true})
    ].filter((d) => {
      // Filter out any inline documents returned by the analyzer
      if (d.isInline === true) {
        return false;
      }
      // Filter out any excluded documents
      const documentUrl = this.urlHandler.getDocumentUrl(d);
      if (this.conversionSettings.excludes.has(documentUrl)) {
        return false;
      }
      // Filter out any external documents
      const packageName =
          this.urlHandler.getOriginalPackageNameForUrl(documentUrl);
      return packageName === matchPackageName;
    });
  }

  /**
   * Scan a document and any of its dependency packages for their new interface.
   */
  scanPackage(matchPackageName: string) {
    if (this.scannedPackages.has(matchPackageName)) {
      return;
    }
    // Add this package to our cache so that it won't get double scanned.
    this.scannedPackages.add(matchPackageName);
    // Gather all relevent package documents, and run the scanner on them.
    for (const document of this.getPackageDocuments(matchPackageName)) {
      this.scanDocument(document);
    }
  }

  /**
   * Scan a document and any of its dependency packages. The scan document
   * format (JS Module or HTML Document) is determined by whether the file is
   * included in conversionSettings.includes.
   */
  scanDocument(document: Document, forceJs = false) {
    console.assert(
        document.kinds.has('html-document'),
        `scanDocument() must be called with an HTML document, but got ${
            document.kinds}`);

    if (!this._shouldScanDocument(document)) {
      return;
    }

    const documentUrl = this.urlHandler.getDocumentUrl(document);
    const documentConverter = new DocumentConverter(
        document,
        this.namespacedExports,
        this.urlHandler,
        this.conversionSettings);
    let scanResult: JsModuleScanResult|HtmlDocumentScanResult|
        DeleteFileScanResult;
    try {
      scanResult =
          (forceJs || this.conversionSettings.includes.has(documentUrl)) ?
          documentConverter.scanJsModule() :
          documentConverter.scanTopLevelHtmlDocument();
    } catch (e) {
      console.error(`Error in ${document.url}`, e);
      return;
    }
    this.results.set(scanResult.originalUrl, scanResult);
    this._scanDependencies(document);
    if (scanResult.type === 'js-module') {
      for (const expr of scanResult.exportMigrationRecords) {
        if (!this.namespacedExports.has(expr.oldNamespacedName)) {
          this.namespacedExports.set(
              expr.oldNamespacedName,
              new JsExport(scanResult.convertedUrl, expr.es6ExportName));
        }
      }
    }
  }

  /**
   * Check if a document is explicitly excluded or has already been scanned
   * to decide if it should be skipped.
   */
  private _shouldScanDocument(document: Document): boolean {
    const documentUrl = this.urlHandler.getDocumentUrl(document);
    return !this.results.has(documentUrl) &&
        !this.conversionSettings.excludes.has(documentUrl);
  }

  /**
   * Scan document dependencies. If a dependency is external to this package,
   * scan the entire external package.
   */
  private _scanDependencies(document: Document) {
    const documentUrl = this.urlHandler.getDocumentUrl(document);
    const packageName =
        this.urlHandler.getOriginalPackageNameForUrl(documentUrl);
    for (const htmlImport of DocumentConverter.getAllHtmlImports(document)) {
      const importDocumentUrl = this.urlHandler.getDocumentUrl(<any>htmlImport);
      const importPackageName =
          this.urlHandler.getOriginalPackageNameForUrl(importDocumentUrl);

      if (importPackageName === packageName) {
        this.scanDocument(htmlImport.document, true);
      } else {
        this.scanPackage(importPackageName);
      }
    }
  }

  getResults() {
    return {
      files: this.results,
      exports: this.namespacedExports,
    };
  }
}
