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

import {UrlResolver} from './url-resolver';

/**
 * Resolves a URL having one prefix to another URL with a different prefix.
 */
export class RedirectResolver extends UrlResolver {
  constructor(private _redirectFrom: string, private _redirectTo: string) {
    super();
  }

  canResolve(url: PackageRelativeUrl): boolean {
    return url.startsWith(this._redirectFrom);
  }

  resolve(url: PackageRelativeUrl): ResolvedUrl {
    if (!this.canResolve(url)) {
      throw new Error(
          `RedirectResolver cannot resolve: "${url}" from:` +
          `"${this._redirectFrom}" to: "${this._redirectTo}"`);
    }
    return this.brandAsResolved(
        this._redirectTo + url.slice(this._redirectFrom.length));
  }
}
