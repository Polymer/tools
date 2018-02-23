/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

export interface PackageScanResult {
  files:
      Map<OriginalDocumentUrl,
          JsModuleScanResult|DeleteFileScanResult|HtmlDocumentScanResult>;
  exports: Map<string, JsExport>;
}

/**
 * PackageScanner provides the top-level interface for scanning any single
 * package. Scanning packages allows us to detect the new ES Module
 * external interface(s) across a project so that we can properly rewrite and
 * convert our files.
 */
export class PackageScanner {
  private readonly packageName: string;
  private readonly analysis: Analysis;
  private readonly urlHandler: UrlHandler;
  private readonly conversionSettings: ConversionSettings;

  /**
   * A set of all external dependencies (by name) actually detected as JS
   * imported by this package.
   */
  readonly externalDependencies = new Set<string>();

  /**
   * All JS Exports for a single package registered by namespaced identifier,
   * to map implicit HTML imports to explicit named JS imports.
   */
  private readonly namespacedExports = new Map<string, JsExport>();

  /**
   * All Scan Results for a single package registered by document URL, so that
   * the conversion process knows how to treat each file.
   */
  private readonly results = new Map<
      OriginalDocumentUrl,
      JsModuleScanResult|DeleteFileScanResult|HtmlDocumentScanResult>();

  constructor(
      packageName: string, analysis: Analysis, urlHandler: UrlHandler,
      conversionSettings: ConversionSettings) {
    this.packageName = packageName;
    this.analysis = analysis;
    this.urlHandler = urlHandler;
    this.conversionSettings = conversionSettings;
  }

  /**
   * Scan a package.
   */
  scanPackage(): PackageScanResult {
    // Add this package to our cache so that it won't get double scanned.
    // Gather all relevent package documents, and run the scanner on them.
    for (const document of this.getPackageDocuments()) {
      this.scanDocument(document);
    }

    return this.getResults();
  }

  /**
   * Get all relevant HTML documents from a package that should be scanned,
   * coverted, or otherwise handled by the modulizer.
   */
  getPackageDocuments() {
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
      return packageName === this.packageName;
    });
  }

  /**
   * Return the results of the package scan.
   */
  getResults(): PackageScanResult {
    return {
      files: this.results,
      exports: this.namespacedExports,
    };
  }

  /**
   * Scan a document and any of its dependency packages. The scan document
   * format (JS Module or HTML Document) is determined by whether the file is
   * included in conversionSettings.includes.
   */
  private scanDocument(document: Document, forceJs = false) {
    console.assert(
        document.kinds.has('html-document'),
        `scanDocument() must be called with an HTML document, but got ${
            document.kinds}`);
    if (!this._shouldScanDocument(document)) {
      return;
    }

    const documentUrl = this.urlHandler.getDocumentUrl(document);
    const documentConverter = new DocumentConverter(
        document, this.urlHandler, this.conversionSettings);
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
   * Scan dependency files of a document. If a file is external to this package,
   * add that dependency to the externalDependencies set to be scanned
   * seperately.
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
        this.externalDependencies.add(importPackageName);
      }
    }
  }
}
