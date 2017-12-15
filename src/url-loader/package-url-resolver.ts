/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {posix as pathlib} from 'path';
import {resolve as urlLibResolver, Url} from 'url';

import {parseUrl} from '../core/utils';
import {FileRelativeUrl, ScannedImport} from '../index';
import {ResolvedUrl} from '../model/url';

import {UrlResolver} from './url-resolver';

export interface PackageUrlResolverOptions {
  componentDir?: string;
  hostname?: string;
}

/**
 * Resolves a URL to a canonical URL within a package.
 */
export class PackageUrlResolver extends UrlResolver {
  private packageUrl = `` as ResolvedUrl;
  componentDir: string;
  hostname: string|null;

  constructor(options?: PackageUrlResolverOptions) {
    super();
    options = options || {};
    this.componentDir = options.componentDir || 'bower_components/';
    this.hostname = options.hostname || null;
  }

  private _isValid(urlObject: Url, pathname: string) {
    return (urlObject.hostname === this.hostname || !urlObject.hostname) &&
        !pathname.startsWith('../../');
  }

  resolve(
      url: FileRelativeUrl, baseUrl: ResolvedUrl = this.packageUrl,
      _import?: ScannedImport): ResolvedUrl|undefined {
    const packageRelativeUrl =
        this.brandAsResolved(urlLibResolver(baseUrl, url));
    if (packageRelativeUrl === undefined) {
      return undefined;
    }
    const urlObject = parseUrl(packageRelativeUrl);
    let pathname;
    try {
      pathname = pathlib.normalize(decodeURI(urlObject.pathname || ''));
    } catch (e) {
      return undefined;  // undecodable url
    }

    if (!this._isValid(urlObject, pathname)) {
      return undefined;
    }

    // If the path points to a sibling directory, resolve it to the
    // component directory
    if (pathname.startsWith('../')) {
      pathname = pathlib.join(this.componentDir, pathname.substring(3));
    }

    // make all paths relative to the root directory
    if (pathlib.isAbsolute(pathname)) {
      pathname = pathname.substring(1);
    }

    // Re-encode URI, since it is expected we are emitting a relative URL.
    return this.brandAsResolved(encodeURI(pathname));
  }

  relative(fromOrTo: ResolvedUrl, maybeTo?: ResolvedUrl, _kind?: string):
      FileRelativeUrl {
    let from, to;
    if (maybeTo !== undefined) {
      from = fromOrTo;
      to = maybeTo;
    } else {
      from = this.packageUrl;
      to = fromOrTo;
    }
    return this.simpleUrlRelative(from, to);
  }
}
