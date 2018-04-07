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

import * as pathlib from 'path';
import {posix as posix} from 'path';
import pathIsInside = require('path-is-inside');
import {format as urlLibFormat} from 'url';

import {parseUrl} from '../core/utils';
import {FileRelativeUrl, PackageRelativeUrl} from '../index';
import {ResolvedUrl} from '../model/url';

import {FsUrlResolver} from './fs-url-resolver';

export interface PackageUrlResolverOptions {
  packageDir?: string;
  componentDir?: string;
  // If provided, any URL which matches `host` will attempt to resolve
  // to a `file` protocol URL regardless of the protocol represented in the
  // URL to-be-resolved.
  host?: string;
  // When attempting to resolve a protocol-relative URL (that is a URL which
  // begins `//`), the default protocol to resolve to if the resolver can
  // not produce a `file` URL.
  protocol?: string;
}

/**
 * Resolves a URL to a canonical URL within a package.
 */
export class PackageUrlResolver extends FsUrlResolver {
  readonly componentDir: string;
  private readonly resolvedComponentDir: string;

  constructor(options: PackageUrlResolverOptions = {}) {
    super(options.packageDir, options.host, options.protocol);
    this.componentDir = options.componentDir || 'bower_components/';
    this.resolvedComponentDir =
        pathlib.join(this.packageDir, this.componentDir);
  }

  protected modifyFsPath(path: string) {
    // If the path points to a sibling directory, resolve it to the
    // component directory
    const parentOfPackageDir = pathlib.dirname(this.packageDir);
    if (pathIsInside(path, parentOfPackageDir) &&
        !pathIsInside(path, this.packageDir)) {
      path = pathlib.join(
          this.packageDir,
          this.componentDir,
          path.substring(parentOfPackageDir.length));
    }

    return path;
  }

  relative(to: ResolvedUrl): PackageRelativeUrl;
  relative(from: ResolvedUrl, to: ResolvedUrl, _kind?: string): FileRelativeUrl;
  relative(fromOrTo: ResolvedUrl, maybeTo?: ResolvedUrl, _kind?: string):
      FileRelativeUrl|PackageRelativeUrl {
    const [from, to] = (maybeTo !== undefined) ? [fromOrTo, maybeTo] :
                                                 [this.packageUrl, fromOrTo];
    const result = this.relativeImpl(from, to);
    if (maybeTo === undefined) {
      return this.brandAsPackageRelative(result);
    } else {
      return result;
    }
  }

  private relativeImpl(from: ResolvedUrl, to: ResolvedUrl): FileRelativeUrl {
    const pathnameInComponentDir = this.pathnameForComponentDirUrl(to);
    // If the URL we're going to is in the component directory, we need
    // to correct for that when generating a relative URL...
    if (pathnameInComponentDir !== undefined) {
      // ... unless the URL we're coming from is *also* in the component
      // directory
      if (this.pathnameForComponentDirUrl(from) === undefined) {
        // Ok, transform the path from looking like `/path/to/node_modules/foo`
        // to look instead like `/path/foo` so we get a `../` relative url.
        const componentDirPath =
            pathnameInComponentDir.slice(this.resolvedComponentDir.length);
        const reresolved = this.simpleUrlResolve(
            this.packageUrl,
            ('../' + componentDirPath) as FileRelativeUrl,
            this.protocol);
        if (reresolved !== undefined) {
          const reresolvedUrl = parseUrl(reresolved);
          const toUrl = parseUrl(to);
          reresolvedUrl.search = toUrl.search;
          reresolvedUrl.hash = toUrl.hash;
          to = this.brandAsResolved(urlLibFormat(reresolvedUrl));
        }
      }
    }

    return super.relative(from, to);
  }

  /**
   * If the given URL is a file url inside our dependencies (e.g.
   * bower_components) then return a resolved posix path to its file.
   * Otherwise return undefined.
   */
  private pathnameForComponentDirUrl(resolvedUrl: ResolvedUrl): string
      |undefined {
    const url = parseUrl(resolvedUrl);
    if (this.shouldHandleAsFileUrl(url) && url.pathname) {
      let pathname;
      try {
        pathname = posix.normalize(decodeURIComponent(url.pathname));
      } catch {
        return undefined;
      }
      const path = this.filesystemPathForPathname(pathname);
      if (path && pathIsInside(path, this.resolvedComponentDir)) {
        return path;
      }
    }
    return undefined;
  }
}
