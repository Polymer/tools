/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {posix as pathlib} from 'path';
import {parse as parseUrl, Url} from 'url';
import {UrlResolver} from './url-resolver';

export interface PackageUrlResolverOptions {
  componentDir?: string;
  hostname?: string
}

/**
 * Resolves a URL to a canonical URL within a package.
 */
export class PackageUrlResolver implements UrlResolver {

  componentDir: string;
  hostname: string;

  constructor(options?: PackageUrlResolverOptions) {
    options = options || {};
    this.componentDir = options.componentDir || 'bower_components/';
    this.hostname = options.hostname || null;
  }

  canResolve(url: string): boolean {
    let urlObject = parseUrl(url);
    let pathname = pathlib.normalize(decodeURIComponent(urlObject.pathname));
    return this._isValid(urlObject, pathname);
  }

  _isValid(urlObject: Url, pathname: string) {
    return (urlObject.hostname === this.hostname || !urlObject.hostname)
        && !pathname.startsWith('../../');
  }

  resolve(url: string): string {
    let urlObject = parseUrl(url);
    let pathname = pathlib.normalize(decodeURIComponent(urlObject.pathname));

    if (!this._isValid(urlObject, pathname)) {
      throw new Error(`Invalid URL ${url}`);
    }

    // If the path points to a sibling directory, resolve it to the
    // component directory
    if (pathname.startsWith('../')) {
      pathname = pathlib.join(this.componentDir,pathname.substring(3));
    }

    // make all paths relative to the root directory
    if (pathlib.isAbsolute(pathname)) {
      pathname = pathname.substring(1);
    }
    return pathname;
  }
}
