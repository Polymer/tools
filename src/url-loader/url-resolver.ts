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

import {PackageRelativeUrl, ResolvedUrl} from '../model/url';

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
   * Returns `true` if this resolver can resolve the given `url`.
   */
  abstract canResolve(url: PackageRelativeUrl): boolean;

  /**
   * Resoves `url` to a new location.
   */
  abstract resolve(url: PackageRelativeUrl): ResolvedUrl;

  protected brandAsResolved(url: string): ResolvedUrl {
    return url as ResolvedUrl;
  }
}
