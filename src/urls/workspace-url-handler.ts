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

import {lookupDependencyMapping} from '../manifest-converter';
import {readJson} from '../manifest-converter';

import {ConvertedDocumentUrl, OriginalDocumentUrl, PackageType} from './types';
import {UrlHandler} from './url-handler';
import {getRelativeUrl} from './util';

/**
 * Given a bower.json file (path to be read from) look-up the corresponding
 * package name on NPM. If lookup fails for any reason, default to the repo name
 * or the Bower package name.
 *
 * TODO(fks) 11-06-2017: Failed/bad lookups can cause serious conversion errors,
 * should a failed lookup throw instead of warn?
 */
export function lookupNpmPackageName(bowerJsonPath: string): string|undefined {
  let bowerPackageName: string;
  // Lookup the official package name via `bower.json`.
  try {
    const bowerJson = readJson(bowerJsonPath);
    bowerPackageName = bowerJson.name as string;
  } catch (err) {
    console.warn(
        `WARNING: "${bowerJsonPath}" not found / could not be read` +
        `(${err.message})`);
    return;
  }
  // Check our dependency map for the corresponding package name on npm.
  const depInfo = lookupDependencyMapping(bowerPackageName);
  if (!depInfo) {
    return bowerPackageName;
  }
  // If lookup was successful, return the correct npm package name.
  return depInfo.npm;
}


export class WorkspaceUrlHandler implements UrlHandler {
  readonly workspaceDir: string;

  constructor(workspaceDir: string) {
    this.workspaceDir = workspaceDir;
  }

  /**
   * Cache the npm package name found for each
   */
  packageNameCache = new Map<string, string>();

  /**
   * Get the name of the package where a file lives, based on it's URL. For a
   * workspace, we read the Bower package name from the bower.json of every
   * repo, and then check dependency map to get the new NPM name for that
   * package.
   */
  getPackageNameForUrl(url: OriginalDocumentUrl) {
    const basePackageDir = url.split('/')[0];
    const cachedPackageName = this.packageNameCache.get(basePackageDir);
    if (cachedPackageName) {
      return cachedPackageName;
    }
    const packageName = this._getPackageNameForUrl(url);
    this.packageNameCache.set(basePackageDir, packageName);
    return packageName;
  }

  /**
   * Get the name of the package where a file lives, based on it's URL.
   */
  _getPackageNameForUrl(url: OriginalDocumentUrl) {
    const packageDirName = url.split('/')[0];
    const bowerPath =
        path.join(this.workspaceDir, packageDirName, 'bower.json');
    return lookupNpmPackageName(bowerPath) || packageDirName;
  }

  /**
   * Get the "type" for the package where a file lives, based on it's URL.
   */
  getPackageTypeForUrl(): PackageType {
    // All packages are currently treated as elements in workspace mode.
    return 'element';
  }

  /**
   * Check if two URLs are internal within the same package.
   */
  isImportInternal(fromUrl: ConvertedDocumentUrl, toUrl: ConvertedDocumentUrl) {
    const fromUrlParts = fromUrl.split('/');
    const toUrlParts = toUrl.split('/');
    if (fromUrlParts[1][0] === '@' && toUrlParts[1][0] === '@') {
      return fromUrlParts[1] === toUrlParts[1] &&
          fromUrlParts[2] === toUrlParts[2];
    } else {
      return fromUrlParts[1] === toUrlParts[1];
    }
  }

  /**
   * Rewrite a bower package name in a URL to its matching npm package name.
   */
  convertUrl(dependencyUrl: OriginalDocumentUrl): ConvertedDocumentUrl {
    const jsUrlPieces = dependencyUrl.split('/');
    const bowerPackageName = jsUrlPieces[0];
    const depInfo = lookupDependencyMapping(bowerPackageName);
    if (depInfo) {
      jsUrlPieces[0] = depInfo.npm;
    }
    return './' + jsUrlPieces.join('/') as ConvertedDocumentUrl;
  }


  /**
   * Get the formatted relative import URL between two ConvertedDocumentUrls.
   */
  getPathImportUrl(fromUrl: ConvertedDocumentUrl, toUrl: ConvertedDocumentUrl):
      string {
    return getRelativeUrl(fromUrl, toUrl);
  }

  /**
   * Get the formatted import URL for a name-based conversion.
   *
   * Ex: `./@polymer/polymer/foo.js` -> `@polymer/polymer/foo.js`
   */
  getNameImportUrl(url: ConvertedDocumentUrl): ConvertedDocumentUrl {
    return url.slice('./'.length) as ConvertedDocumentUrl;
  }
}
