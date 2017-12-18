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

import {posix} from 'path';
import {resolve as urlLibResolver} from 'url';

import {parseUrl} from '../core/utils';
import {ScannedImport} from '../index';
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
  abstract resolve(
      url: FileRelativeUrl, baseUrl?: ResolvedUrl,
      scannedImport?: ScannedImport): ResolvedUrl|undefined;

  abstract relative(to: ResolvedUrl): FileRelativeUrl;
  abstract relative(from: ResolvedUrl, to?: ResolvedUrl, kind?: string):
      FileRelativeUrl;

  protected simpleUrlResolve(url: FileRelativeUrl, baseUrl: ResolvedUrl):
      ResolvedUrl {
    let resolved = urlLibResolver(baseUrl, url);
    if (url.endsWith('/') && !resolved.endsWith('/')) {
      resolved += '/';
    }
    return this.brandAsResolved(resolved);
  }

  protected simpleUrlRelative(from: ResolvedUrl, to: ResolvedUrl):
      FileRelativeUrl {
    const fromUrl = parseUrl(from);
    const toUrl = parseUrl(to);
    if (toUrl.protocol && toUrl.protocol !== fromUrl.protocol) {
      return this.brandAsRelative(to);
    }
    if (toUrl.host && toUrl.host !== fromUrl.host) {
      return this.brandAsRelative(to);
    }
    let fromPath = decodeURIComponent(fromUrl.pathname || '');
    const toPath = decodeURIComponent(toUrl.pathname || '');
    if (!fromPath.endsWith('/')) {
      fromPath = posix.dirname(fromPath);
    }
    let relativized = encodeURI(posix.relative(fromPath, toPath));
    if (toPath.endsWith('/') && !relativized.endsWith('/')) {
      relativized += '/';
    }
    return this.brandAsRelative(relativized);
  }

  protected brandAsRelative(url: string): FileRelativeUrl {
    return url as FileRelativeUrl;
  }

  protected brandAsResolved(url: string): ResolvedUrl {
    return url as ResolvedUrl;
  }
}
