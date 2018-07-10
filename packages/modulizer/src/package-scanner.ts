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

import fetch from 'node-fetch';
import {Analysis, Document, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {filesJsonObjectToMap, PackageScanResultJson, serializePackageScanResult} from './conversion-manifest';
import {ConversionSettings} from './conversion-settings';
import {DocumentConverter} from './document-converter';
import {ScanResult} from './document-scanner';
import {DocumentScanner} from './document-scanner';
import {isImportWithDocument} from './import-with-document';
import {JsExport} from './js-module';
import {lookupDependencyMapping} from './package-manifest';
import {OriginalDocumentUrl} from './urls/types';
import {UrlHandler} from './urls/url-handler';

// These types represent the data surfaced from a package scan. The full
// PackageScanResult object contains both a mapping of all files from old->new,
// and a mapping of all exports from implicit global namespace references to
// new ES6 imports by name.
export type PackageScanFiles = Map<OriginalDocumentUrl, ScanResult>;
export type PackageScanExports = Map<string, JsExport>;
export interface PackageScanResult {
  files: PackageScanFiles;
  exports: PackageScanExports;
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
  private readonly topLevelEntrypoints: Set<OriginalDocumentUrl> = new Set();

  /**
   * A set of all external dependencies (by name) actually detected as JS
   * imported by this package.
   */
  readonly externalDependencies = new Set<string>();

  /**
   * All JS Exports for a single package registered by namespaced identifier,
   * to map implicit HTML imports to explicit named JS imports.
   */
  private readonly namespacedExports: PackageScanExports = new Map();

  /**
   * All Scan Results for a single package registered by document URL, so that
   * the conversion process knows how to treat each file.
   */
  private readonly results: PackageScanFiles = new Map();

  constructor(
      packageName: string, analysis: Analysis, urlHandler: UrlHandler,
      conversionSettings: ConversionSettings,
      topLevelEntrypoints: Set<OriginalDocumentUrl>) {
    this.packageName = packageName;
    this.analysis = analysis;
    this.urlHandler = urlHandler;
    this.conversionSettings = conversionSettings;
    this.topLevelEntrypoints = topLevelEntrypoints;
  }

  /**
   * Scan a package and return the scan result. This method will first try to
   * fetch a package manifest from npm. Failing that (no manifest exists, npm
   * cannot be reached, etc.) it will scan the package manually.
   */
  async scanPackage(forceScan = false): Promise<PackageScanResult> {
    let resultsFromManifest;
    if (forceScan !== false) {
      resultsFromManifest = await this.getResultsFromManifest();
    }
    if (resultsFromManifest !== undefined) {
      this.scanPackageFromManifest(resultsFromManifest);
    } else {
      this.scanPackageManually();
    }
    return this.getResults();
  }

  /**
   * Get a package manifest (a serializable version of the scanner results) for
   * a package.
   */
  private scanPackageFromManifest(packageScanManifest: PackageScanResult) {
    for (const [originalUrl, scanResult] of packageScanManifest.files) {
      this.results.set(originalUrl, scanResult);
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
  }

  /**
   * Scan each document in a package manually. The scan document format (JS
   * Module or HTML Document) is determined by whether the file is included in
   * the entry for this package in `conversionSettings.packageEntrypoints` which
   * is assigned to `this.topLevelEntrypoints`.
   */
  scanPackageManually() {
    // Scan top-level entrypoints first, to make sure their dependencies are
    // properly converted to JS modules as well.
    for (const document of this.getPackageHtmlDocuments()) {
      if (this.topLevelEntrypoints.has(
              this.urlHandler.getDocumentUrl(document))) {
        this.scanDocument(document, 'js-module');
      }
    }
    // Scan all other documents, to be converted as top-level HTML files.
    for (const document of this.getPackageHtmlDocuments()) {
      // If the document was scanned above, don't scan it again. (`scanDocument`
      // also checks this.)
      if (this.shouldScanDocument(document)) {
        this.scanDocument(document, 'html-document');
      }
    }
  }

  /**
   * Fetch a conversion manifest from NPM. If none can be found, return null.
   */
  async getResultsFromManifest(): Promise<PackageScanResult|undefined> {
    const npmPackageInfo = lookupDependencyMapping(this.packageName);
    if (!npmPackageInfo) {
      return undefined;
    }

    try {
      const unpkgResponse = await fetch(`https://unpkg.com/${
          npmPackageInfo.npm}@${npmPackageInfo.semver}/manifest.json`);
      const manifestJson: PackageScanResultJson = await unpkgResponse.json();
      const [allFiles, allExports] = filesJsonObjectToMap(
          this.packageName, npmPackageInfo.npm, manifestJson, this.urlHandler);
      return {
        files: allFiles,
        exports: allExports,
      };
    } catch (err) {
      return undefined;
    }
  }

  /**
   * Get all relevant HTML documents from a package that should be scanned,
   * coverted, or otherwise handled by the modulizer.
   */
  getPackageHtmlDocuments() {
    return [
      ...this.analysis.getFeatures({
        // Set externalPackages=true so that this method works on dependencies
        // packages as well. We filter out files from outside this package in
        // the method below.
        externalPackages: true,
        kind: 'html-document',
      })
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
      // Filter out any documents external *to this package*
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
   * Get a package manifest (a serializable version of the scanner results) for
   * a package.
   */
  getConversionManifest(): PackageScanResultJson {
    return serializePackageScanResult(
        this.results, this.namespacedExports, this.urlHandler);
  }

  /**
   * Scan a document and any of its dependency packages.
   */
  private scanDocument(
      document: Document<ParsedHtmlDocument>,
      scanAs: 'js-module'|'html-document') {
    console.assert(
        document.kinds.has('html-document'),
        `scanDocument() must be called with an HTML document, but got ${
            document.kinds}`);
    if (!this.shouldScanDocument(document)) {
      return;
    }

    const documentScanner = new DocumentScanner(
        document, this.packageName, this.urlHandler, this.conversionSettings);
    let scanResult: ScanResult;
    try {
      scanResult = scanAs === 'js-module' ?
          documentScanner.scanJsModule() :
          documentScanner.scanTopLevelHtmlDocument();
    } catch (e) {
      console.error(`Error in ${document.url}`, e);
      return;
    }
    this.results.set(scanResult.originalUrl, scanResult);
    this.scanDependencies(document);
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
  private shouldScanDocument(document: Document): boolean {
    const documentUrl = this.urlHandler.getDocumentUrl(document);
    return !this.results.has(documentUrl) &&
        !this.conversionSettings.excludes.has(documentUrl);
  }

  /**
   * Scan dependency files of a document. If a file is external to this package,
   * add that dependency to the externalDependencies set to be scanned
   * seperately.
   */
  private scanDependencies(document: Document) {
    const documentUrl = this.urlHandler.getDocumentUrl(document);
    const packageName =
        this.urlHandler.getOriginalPackageNameForUrl(documentUrl);

    for (const htmlImport of DocumentConverter.getAllHtmlImports(document)) {
      if (!isImportWithDocument(htmlImport)) {
        console.warn(
            new Warning({
              code: 'import-ignored',
              message: `Import could not be loaded and will be ignored.`,
              parsedDocument: document.parsedDocument,
              severity: Severity.WARNING,
              sourceRange: htmlImport.sourceRange!,
            }).toString());
        continue;
      }

      const importDocumentUrl = this.urlHandler.getDocumentUrl(htmlImport);
      const importPackageName =
          this.urlHandler.getOriginalPackageNameForUrl(importDocumentUrl);

      if (importPackageName === packageName) {
        this.scanDocument(
            htmlImport.document as Document<ParsedHtmlDocument>, 'js-module');
      } else {
        this.externalDependencies.add(importPackageName);
      }
    }
  }
}
