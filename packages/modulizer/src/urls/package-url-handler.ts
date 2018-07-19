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

import * as path from 'path';
import {Analyzer, Document, Import} from 'polymer-analyzer';

import {lookupDependencyMapping} from '../package-manifest';

import {ConvertedDocumentFilePath, ConvertedDocumentUrl, OriginalDocumentUrl, PackageType} from './types';
import {UrlHandler} from './url-handler';
import {getRelativeUrl} from './util';


/**
 * Handle URLs in a single "package-based" layout. This converter should be used
 * to convert a single package, where all existing Bower dependencies are
 * installed in a "bower_components/" sub-directory inside the main package
 * directory.
 */
export class PackageUrlHandler implements UrlHandler {
  readonly packageDir: string;
  readonly bowerPackageName: string;
  readonly npmPackageName: string;
  readonly packageType: PackageType;
  readonly analyzer: Analyzer;

  /**
   * Helper function to check if a file URL is internal to the main package
   * being converted (vs. a dependency).
   */
  static isUrlInternalToPackage(url: ConvertedDocumentUrl|OriginalDocumentUrl|
                                ConvertedDocumentFilePath) {
    // OriginalDocumentUrl will always be format `bower_components/*`
    // ConvertedDocument[Url|FilePath] will always be format `./node_modules/*`
    return !url.startsWith('bower_components/') &&
        !url.startsWith('./node_modules/');
  }

  constructor(
      analyzer: Analyzer, bowerPackageName: string, npmPackageName: string,
      packageType: PackageType, packageDir: string) {
    this.analyzer = analyzer;
    this.bowerPackageName = bowerPackageName;
    this.npmPackageName = npmPackageName;
    this.packageType = packageType;
    this.packageDir = packageDir;
  }

  getPackageDir(packageName: string): string {
    if (packageName === this.bowerPackageName) {
      return this.packageDir;
    } else {
      return path.join(this.packageDir, 'bower_components', packageName);
    }
  }

  /**
   * Return a document url property as a OriginalDocumentUrl type.
   * OriginalDocumentUrl is relative to the project under conversion, unlike
   * the analyzer's ResolvedUrl, which is absolute to the file system.
   */
  getDocumentUrl(document: Document|Import): OriginalDocumentUrl {
    const relativeUrl =
        this.analyzer.urlResolver.relative(document.url) as string;
    // If the analyzer URL is outside the current directory, it actually exists
    // in the child bower_components/ directory.
    if (relativeUrl.startsWith('../')) {
      return 'bower_components/' + relativeUrl.substring(3) as
          OriginalDocumentUrl;
    } else {
      return relativeUrl as OriginalDocumentUrl;
    }
  }

  /**
   * Get the name of the package where a file lives, based on it's URL. For a
   * workspace, we read the Bower package name from the bower.json of every
   * repo, and then check dependency map to get the new NPM name for that
   * package.
   */
  getOriginalPackageNameForUrl(url: OriginalDocumentUrl): string {
    if (url.startsWith('bower_components/')) {
      return url.split('/')[1];
    } else {
      return this.bowerPackageName;
    }
  }

  /**
   * Get the "type" for the package where a file lives, based on it's URL.
   */
  getPackageTypeForUrl(url: OriginalDocumentUrl) {
    if (PackageUrlHandler.isUrlInternalToPackage(url)) {
      return this.packageType;
    } else {
      return 'element';
    }
  }

  /**
   * Check if two URLs are internal within the same package.
   */
  isImportInternal(fromUrl: ConvertedDocumentUrl, toUrl: ConvertedDocumentUrl) {
    if (!fromUrl.startsWith('./node_modules') &&
        !toUrl.startsWith('./node_modules')) {
      return true;
    }
    if (fromUrl.startsWith('./node_modules') &&
        toUrl.startsWith('./node_modules')) {
      const fromUrlParts = fromUrl.split('/');
      const toUrlParts = toUrl.split('/');
      if (fromUrlParts[2][0] === '@' && toUrlParts[2][0] === '@') {
        return fromUrlParts[2] === toUrlParts[2] &&
            fromUrlParts[3] === toUrlParts[3];
      } else {
        return fromUrlParts[2] === toUrlParts[2];
      }
    }
    return false;
  }

  /**
   * Rewrite a Bower package name in a URL to its matching npm package name.
   */
  convertUrl(url: OriginalDocumentUrl): ConvertedDocumentUrl {
    if (PackageUrlHandler.isUrlInternalToPackage(url)) {
      // TODO(fks): Revisit this format? The analyzer returns URLs without this
      return ('./' + url) as ConvertedDocumentUrl;
    }
    const newUrl = url.replace('bower_components/', 'node_modules/');
    const newUrlPieces = newUrl.split('/');
    const bowerPackageName = newUrlPieces[1];
    if (bowerPackageName === this.bowerPackageName) {
      newUrlPieces[1] = this.npmPackageName;
    } else {
      const depInfo = lookupDependencyMapping(bowerPackageName);
      if (depInfo) {
        newUrlPieces[1] = depInfo.npm;
      }
    }
    return ('./' + newUrlPieces.join('/')) as ConvertedDocumentUrl;
  }

  /**
   * Create a ConvertedDocumentUrl formatted for the current project layout.
   * Useful when the converted file location is known ahead of time.
   */
  createConvertedUrl(partialUrl: string) {
    return `./node_modules/${partialUrl}` as ConvertedDocumentUrl;
  }

  /**
   * Get the formatted relative import URL between two ConvertedDocumentUrls.
   */
  getPathImportUrl(fromUrl: ConvertedDocumentUrl, toUrl: ConvertedDocumentUrl):
      string {
    const isPackageNameScoped = this.npmPackageName.startsWith('@');
    const isPackageTypeElement = this.packageType === 'element';
    const isImportFromLocalFile =
        PackageUrlHandler.isUrlInternalToPackage(fromUrl);
    const isImportToExternalFile =
        !PackageUrlHandler.isUrlInternalToPackage(toUrl);
    let importUrl = getRelativeUrl(fromUrl, toUrl);

    // If the import is from the current project:
    if (isImportFromLocalFile && isPackageTypeElement) {
      // Rewrite imports to point to dependencies as if they were siblings.
      if (importUrl.startsWith('./node_modules/')) {
        importUrl = '../' + importUrl.slice('./node_modules/'.length);
      } else {
        importUrl = importUrl.replace('node_modules', '..');
      }
      // Account for a npm package name scoping.
      if (isPackageNameScoped && isImportToExternalFile) {
        if (importUrl.startsWith('./')) {
          importUrl = '../' + importUrl.slice('./'.length);
        } else {
          importUrl = '../' + importUrl;
        }
      }
    }

    return importUrl;
  }

  /**
   * Get the formatted import URL for a name-based conversion.
   *
   * Ex: `./node_modules/@polymer/polymer/foo.js` -> `@polymer/polymer/foo.js`
   */
  getNameImportUrl(url: ConvertedDocumentUrl): ConvertedDocumentUrl {
    return url.slice('./node_modules/'.length) as ConvertedDocumentUrl;
  }

  originalUrlToPackageRelative(url: OriginalDocumentUrl): string {
    if (url.startsWith('bower_components/')) {
      return url.split('/').splice(1).join('/');
    } else {
      return url;
    }
  }

  convertedUrlToPackageRelative(url: ConvertedDocumentUrl): string {
    if (url.startsWith('./node_modules/@')) {
      return url.split('/').splice(4).join('/');
    } else if (url.startsWith('./node_modules/')) {
      return url.split('/').splice(3).join('/');
    } else {
      return url.substring('./'.length);
    }
  }

  convertedDocumentFilePathToPackageRelative(url: ConvertedDocumentFilePath):
      string {
    return this.originalUrlToPackageRelative(
        url as string as OriginalDocumentUrl);
  }

  packageRelativeToOriginalUrl(originalPackageName: string, url: string):
      OriginalDocumentUrl {
    if (originalPackageName === this.bowerPackageName) {
      return url as OriginalDocumentUrl;
    } else {
      return 'bower_components/' + originalPackageName + '/' + url as
          OriginalDocumentUrl;
    }
  }

  packageRelativeToConvertedUrl(convertedPackageName: string, url: string):
      ConvertedDocumentUrl {
    if (convertedPackageName === this.npmPackageName) {
      return './' + url as ConvertedDocumentUrl;
    } else {
      return './node_modules/' + convertedPackageName + '/' + url as
          ConvertedDocumentUrl;
    }
  }

  packageRelativeToConvertedDocumentFilePath(packageName: string, url: string):
      ConvertedDocumentFilePath {
    return this.packageRelativeToOriginalUrl(packageName, url) as string as
        ConvertedDocumentFilePath;
  }

  packageRelativeConvertedUrlToConvertedDocumentFilePath(
      originalPackageName: string, url: string): ConvertedDocumentFilePath {
    if (originalPackageName === this.bowerPackageName) {
      return url as ConvertedDocumentFilePath;
    } else {
      return `bower_components/${originalPackageName}/${url}` as
          ConvertedDocumentFilePath;
    }
  }
}
