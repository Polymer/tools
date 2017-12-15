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

import {FileRelativeUrl, ResolvedUrl, ScannedImport} from '../model/model';

import {UrlResolver} from './url-resolver';

/**
 * Resolves a URL using multiple resolvers.
 */
export class MultiUrlResolver extends UrlResolver {
  constructor(private _resolvers: ReadonlyArray<UrlResolver>) {
    super();
  }

  resolve(url: FileRelativeUrl, baseUrl: ResolvedUrl, import_?: ScannedImport):
      ResolvedUrl|undefined {
    for (const resolver of this._resolvers) {
      const resolved = resolver.resolve(url, baseUrl, import_);
      if (resolved !== undefined) {
        return resolved;
      }
    }
    return undefined;
  }

  relative(fromOrTo: ResolvedUrl, maybeTo?: ResolvedUrl, kind?: string):
      FileRelativeUrl {
    for (const resolver of this._resolvers) {
      return resolver.relative(fromOrTo, maybeTo, kind);
    }
    throw new Error(
        `Could not get relative url, with no configured url resolvers`);
  }
}
