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

import * as fse from 'fs-extra';
import * as path from 'path';
import {Analysis} from 'polymer-analyzer';

import {BowerConfig} from './bower-config';
import {ConversionSettings} from './conversion-settings';
import {ScanResult} from './document-scanner';
import {JsExport} from './js-module';
import {PackageScanner} from './package-scanner';
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
  async getPackageHtmlDocuments(packageName: string) {
    if (!this.scannedPackages.has(packageName)) {
      await this.scanPackage(packageName);
    }
    const packageScanner = this.scannedPackages.get(packageName)!;
    return packageScanner.getPackageHtmlDocuments();
  }

  /**
   * Get a package manifest (a serializable version of the scanner results) for
   * a package.
   */
  async getConversionManifest(packageName: string) {
    if (!this.scannedPackages.has(packageName)) {
      await this.scanPackage(packageName);
    }
    const packageScanner = this.scannedPackages.get(packageName)!;
    return packageScanner.getConversionManifest();
  }

  /**
   * Reads the entrypoints for a package from the `main` field in the package's
   * 'bower.json' file.
   */
  private async readBowerJsonEntrypoints(bowerPackageName: string) {
    const bowerJsonPath = path.join(
        this.urlHandler.getPackageDir(bowerPackageName), 'bower.json');

    let bowerJson: Partial<BowerConfig>|undefined = undefined;
    try {
      bowerJson = await fse.readJSON(bowerJsonPath) as Partial<BowerConfig>;
    } catch {
      console.warn(
          `Failed to read entrypoints of package '${bowerPackageName}' ` +
          `because the package does not have a 'bower.json' file.`);
    }

    let bowerMainFiles = bowerJson ? bowerJson.main : [];
    if (typeof bowerMainFiles === 'string') {
      bowerMainFiles = [bowerMainFiles];
    } else if (bowerMainFiles === undefined) {
      bowerMainFiles = [];
    }

    return bowerMainFiles.map(
        (relativeOriginalUrl) => this.urlHandler.packageRelativeToOriginalUrl(
            bowerPackageName, relativeOriginalUrl));
  }

  /**
   * Scan a document and any of its dependency packages for their new interface.
   */
  async scanPackage(bowerPackageName: string, forceScan = false) {
    if (this.scannedPackages.has(bowerPackageName)) {
      return;
    }

    // If the package has custom entrypoints listed in the conversion settings,
    // use those. Otherwise, read them from the package's 'bower.json'.
    const topLevelEntrypoints =
        this.conversionSettings.packageEntrypoints.get(bowerPackageName) ||
        await this.readBowerJsonEntrypoints(bowerPackageName);

    const packageScanner = new PackageScanner(
        bowerPackageName,
        this.analysis,
        this.urlHandler,
        this.conversionSettings,
        new Set(topLevelEntrypoints));
    await packageScanner.scanPackage(forceScan);
    // Add this scanner to our cache so that it won't get double scanned.
    this.scannedPackages.set(bowerPackageName, packageScanner);
    // Scan all dependencies of this package as well.
    for (const externalDependencyName of packageScanner.externalDependencies) {
      await this.scanPackage(externalDependencyName, false);
    }
  }

  getResults() {
    const allResults = [...this.scannedPackages.values()].map(
        (scanner) => scanner.getResults());
    const allFiles = new Map<OriginalDocumentUrl, ScanResult>();
    const allExports = new Map<string, JsExport>();

    for (const result of allResults) {
      for (const [fileOriginalUrl, scanResult] of result.files) {
        allFiles.set(fileOriginalUrl as OriginalDocumentUrl, scanResult);
      }
      for (const [exportName, exportInfo] of result.exports) {
        if (allExports.has(exportName)) {
          console.warn(
              `CONFLICT: JS Export ${exportName} claimed by two packages: ${
                  exportInfo.url} & ${allExports.get(exportName)!.url}`);
        }
        allExports.set(
            exportName, new JsExport(exportInfo.url, exportInfo.name));
      }
    }

    return {
      files: allFiles,
      exports: allExports,
    };
  }
}
