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

import {Analysis} from 'polymer-analyzer';

import {ConversionSettings} from './conversion-settings';
import {DeleteFileScanResult, HtmlDocumentScanResult, JsModuleScanResult, ScanResult} from './document-converter';
import {JsExport} from './js-module';
import {PackageScanner} from './package-scanner';
import {OriginalDocumentUrl} from './urls/types';
import {UrlHandler} from './urls/url-handler';

function exportsMapToObject(exportsMap: Map<string, JsExport>) {
  const exportsObject: any = {};
  for (const [k, v] of exportsMap) {
    exportsObject[k] = { name: v.name, url: v.url };
  }
  return exportsObject;
}

function filesMapToObject(filesMap: Map<OriginalDocumentUrl, ScanResult>) {
  const filesObject: any = {};
  for (const [k, v] of filesMap) {
    filesObject[k] = (<any>v).convertedUrl || null;
  }
  return filesObject;
}

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
  private readonly scannedPackages = new Map<string, PackageScanner>();

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
  getPackageDocuments(packageName: string) {
    if (!this.scannedPackages.has(packageName)) {
      this.scanPackage(packageName);
    }
    const packageScanner = this.scannedPackages.get(packageName)!;
    return packageScanner.getPackageDocuments();
  }

  /**
   * Get a package manifest (a serializable version of the scanner results) for
   * a package.
   */
  getPackageManifest(packageName: string) {
    if (!this.scannedPackages.has(packageName)) {
      this.scanPackage(packageName);
    }

    const packageScanner = this.scannedPackages.get(packageName)!;
    const scanResults = packageScanner.getResults();
    return {
      files: filesMapToObject(scanResults.files),
      exports: exportsMapToObject(scanResults.exports),
    };
  }


  /**
   * Scan a document and any of its dependency packages for their new interface.
   */
  scanPackage(matchPackageName: string) {
    if (this.scannedPackages.has(matchPackageName)) {
      return;
    }
    // Add this package to our cache so that it won't get double scanned.
    const packageScanner = new PackageScanner(
        matchPackageName,
        this.analysis,
        this.urlHandler,
        this.conversionSettings);
    this.scannedPackages.set(matchPackageName, packageScanner);
    packageScanner.scanPackage();
    for (const externalDependencyName of packageScanner.externalDependencies) {
      this.scanPackage(externalDependencyName);
    }
  }

  getResults() {
    const allResults = [...this.scannedPackages.values()].map(
        (scanner) => scanner.getResults());
    const allFiles = new Map<
        OriginalDocumentUrl,
        JsModuleScanResult|DeleteFileScanResult|HtmlDocumentScanResult>();
    const allExports = new Map<string, JsExport>();
    for (const result of allResults) {
      for (const [fileOriginalUrl, scanResult] of result.files) {
        allFiles.set(fileOriginalUrl, scanResult);
      }
      for (const [exportName, exportInfo] of result.exports) {
        if (allExports.has(exportName)) {
          console.warn(
              `CONFLICT: JS Export ${exportName} claimed by two packages: ${
                  exportInfo.url} & ${allExports.get(exportName)!.url}`);
        }
        allExports.set(exportName, exportInfo);
      }
    }
    return {
      files: allFiles,
      exports: allExports,
    };
  }
}
