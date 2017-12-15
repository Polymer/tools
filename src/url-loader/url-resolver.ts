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

  protected simpleUrlRelative(from: ResolvedUrl, to: ResolvedUrl):
      FileRelativeUrl {
    if (!from.endsWith('/')) {
      from = this.brandAsResolved(posix.dirname(from));
    }
    let result = posix.relative(from, to);
    if (to.endsWith('/')) {
      result += '/';
    }
    return this.brandAsRelative(result);
  }

  protected brandAsRelative(url: string): FileRelativeUrl {
    return url as FileRelativeUrl;
  }

  protected brandAsResolved(url: string): ResolvedUrl {
    return url as ResolvedUrl;
  }
}
