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

import {resolve as urlLibResolver} from 'url';

import {PackageRelativeUrl} from '../index';
import {FileRelativeUrl, ResolvedUrl, ScannedImport} from '../model/model';

import {UrlResolver} from './url-resolver';

/**
 * Resolves a URL having one prefix to another URL with a different prefix.
 */
export class RedirectResolver extends UrlResolver {
  constructor(
      private readonly packageUrl: ResolvedUrl,
      private readonly _redirectFrom: string,
      private readonly _redirectTo: string) {
    super();
  }

  resolve(
      firstUrl: ResolvedUrl|PackageRelativeUrl, secondUrl?: FileRelativeUrl,
      _import?: ScannedImport): ResolvedUrl|undefined {
    const [baseUrl = this.packageUrl, unresolvedUrl] =
        this.getBaseAndUnresolved(firstUrl, secondUrl);
    const packageRelativeUrl =
        this.brandAsResolved(urlLibResolver(baseUrl, unresolvedUrl));
    if (packageRelativeUrl === undefined ||
        !packageRelativeUrl.startsWith(this._redirectFrom)) {
      return undefined;
    }
    return this.brandAsResolved(
        this._redirectTo + packageRelativeUrl.slice(this._redirectFrom.length));
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
