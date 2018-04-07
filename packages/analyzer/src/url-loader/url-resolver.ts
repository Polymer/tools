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

import * as path from 'path';
import {format as urlLibFormat} from 'url';

import {parseUrl, resolveUrl} from '../core/utils';
import {PackageRelativeUrl, ScannedImport} from '../index';
import {FileRelativeUrl, ResolvedUrl} from '../model/url';

/**
 * Resolves the given URL to the concrete URL that a resource can
 * be loaded from.
 *
 * This can be useful to resolve name to paths, such as resolving 'polymer' to
 * '../polymer/polymer.html', or component paths, like '../polymer/polymer.html'
 * to '/bower_components/polymer/polymer.html'.
 */
export abstract class UrlResolver {
  /**
   * Resoves `url` to a new location.
   *
   * Returns `undefined` if the given url cannot be resolved.
   */
  abstract resolve(url: PackageRelativeUrl): ResolvedUrl|undefined;
  abstract resolve(
      baseUrl: ResolvedUrl, url: FileRelativeUrl,
      scannedImport?: ScannedImport): ResolvedUrl|undefined;

  abstract relative(to: ResolvedUrl): PackageRelativeUrl;
  abstract relative(from: ResolvedUrl, to: ResolvedUrl, kind?: string):
      FileRelativeUrl;

  protected getBaseAndUnresolved(
      url1: PackageRelativeUrl|ResolvedUrl, url2?: FileRelativeUrl):
      [ResolvedUrl|undefined, FileRelativeUrl|PackageRelativeUrl] {
    return url2 === undefined ?
        [undefined, this.brandAsPackageRelative(url1)] :
        [this.brandAsResolved(url1), this.brandAsFileRelative(url2)];
  }

  protected simpleUrlResolve(
      baseUrl: ResolvedUrl, url: FileRelativeUrl|PackageRelativeUrl,
      defaultProtocol: string): ResolvedUrl {
    return this.brandAsResolved(resolveUrl(baseUrl, url, defaultProtocol));
  }

  protected simpleUrlRelative(from: ResolvedUrl, to: ResolvedUrl):
      FileRelativeUrl {
    const fromUrl = parseUrl(from);
    const toUrl = parseUrl(to);
    // Return the `to` as-is if there are conflicting components which
    // prohibit calculating a relative form.
    if (typeof toUrl.protocol === 'string' &&
            fromUrl.protocol !== toUrl.protocol ||
        typeof toUrl.slashes === 'boolean' &&
            fromUrl.slashes !== toUrl.slashes ||
        typeof toUrl.host === 'string' && fromUrl.host !== toUrl.host ||
        typeof toUrl.auth === 'string' && fromUrl.auth !== toUrl.auth) {
      return this.brandAsFileRelative(to);
    }
    let pathname;
    const {search, hash} = toUrl;
    if (fromUrl.pathname === toUrl.pathname) {
      pathname = '';
    } else {
      const fromDir = typeof fromUrl.pathname === 'string' ?
          fromUrl.pathname.replace(/[^/]+$/, '') :
          '';
      const toDir = typeof toUrl.pathname === 'string' &&
              typeof toUrl.pathname === 'string' ?
          toUrl.pathname :
          '';
      // In a browserify environment, there isn't path.posix.
      const pathlib = path.posix || path;
      // Note, below, the _ character is appended to the `toDir` so that paths
      // with trailing slash will retain the trailing slash in the result.

      pathname = pathlib.relative(fromDir, toDir + '_').replace(/_$/, '');
    }
    return this.brandAsFileRelative(urlLibFormat({pathname, search, hash}));
  }

  protected brandAsFileRelative(url: string): FileRelativeUrl {
    return url as FileRelativeUrl;
  }

  protected brandAsPackageRelative(url: string): PackageRelativeUrl {
    return url as PackageRelativeUrl;
  }

  protected brandAsResolved(url: string): ResolvedUrl {
    return url as ResolvedUrl;
  }
}
