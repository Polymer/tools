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
import {format as urlLibFormat, Url} from 'url';
import Uri from 'vscode-uri';

import {parseUrl} from '../core/utils';
import {FileRelativeUrl, PackageRelativeUrl, ScannedImport} from '../index';
import {ResolvedUrl} from '../model/url';

import {UrlResolver} from './url-resolver';

export interface PackageUrlResolverOptions {
  packageDir?: string;
  componentDir?: string;
  hostname?: string;
}

const isWindows = process.platform === 'win32';

/**
 * Resolves a URL to a canonical URL within a package.
 */
export class PackageUrlResolver extends UrlResolver {
  private readonly packageDir: string;
  private readonly packageUrl: ResolvedUrl;
  readonly componentDir: string;
  readonly hostname: string|null;
  private readonly resolvedComponentDir: string;

  constructor(options?: PackageUrlResolverOptions) {
    super();
    options = options || {};
    this.packageDir =
        normalizeFsPath(pathlib.resolve(options.packageDir || process.cwd()));
    this.packageUrl =
        this.brandAsResolved(Uri.file(this.packageDir).toString());
    if (!this.packageUrl.endsWith('/')) {
      this.packageUrl = this.brandAsResolved(this.packageUrl + '/');
    }
    this.componentDir = options.componentDir || 'bower_components/';
    this.hostname = options.hostname || null;
    this.resolvedComponentDir =
        pathlib.join(this.packageDir, this.componentDir);
  }

  resolve(
      firstHref: ResolvedUrl|PackageRelativeUrl, secondHref?: FileRelativeUrl,
      _import?: ScannedImport): ResolvedUrl|undefined {
    const [baseUrl = this.packageUrl, unresolvedHref] =
        this.getBaseAndUnresolved(firstHref, secondHref);
    const resolvedHref = this.simpleUrlResolve(baseUrl, unresolvedHref);
    if (resolvedHref === undefined) {
      return undefined;
    }
    const url = parseUrl(resolvedHref);
    if (this.shouldHandleAsFileUrl(url)) {
      return this.handleFileUrl(url, unresolvedHref);
    }
    return this.brandAsResolved(resolvedHref);
  }

  private shouldHandleAsFileUrl(url: Url) {
    const isLocalFileUrl =
        url.protocol === 'file:' && (!url.host || url.host === 'localhost');
    const isOurHostname = url.hostname === this.hostname;
    return isLocalFileUrl || isOurHostname;
  }

  /**
   * Take the given URL which is either a file:// url or a url with the
   * configured hostname, and treat its pathname as though it points to a file
   * on the local filesystem, producing a file:/// url.
   *
   * Also corrects sibling URLs like `../foo` to point to
   * `./${component_dir}/foo`
   */
  private handleFileUrl(url: Url, unresolvedHref: string) {
    let pathname: string;
    const unresolvedUrl = parseUrl(unresolvedHref);
    if (unresolvedUrl.pathname && unresolvedUrl.pathname.startsWith('/') &&
        unresolvedUrl.protocol !== 'file:') {
      // Absolute urls point to the package root.
      let unresolvedPathname: string;
      try {
        unresolvedPathname =
            posix.normalize(decodeURIComponent(unresolvedUrl.pathname));
      } catch (e) {
        return undefined;  // undecodable url
      }
      pathname = pathlib.join(this.packageDir, unresolvedPathname);
    } else {
      // Otherwise, consider the url that has already been resolved
      // against the baseUrl
      try {
        pathname = posix.normalize(decodeURIComponent(url.pathname || ''));
      } catch (e) {
        return undefined;  // undecodable url
      }
    }

    // If the path points to a sibling directory, resolve it to the
    // component directory
    const parentOfPackageDir = pathlib.dirname(this.packageDir);
    let path = this.filesystemPathForPathname(pathname);
    if (path.startsWith(parentOfPackageDir) &&
        !path.startsWith(this.packageDir)) {
      path = pathlib.join(
          this.packageDir,
          this.componentDir,
          path.substring(parentOfPackageDir.length));
    }

    // TODO(rictic): investigate moving to whatwg URLs internally:
    //     https://github.com/Polymer/polymer-analyzer/issues/804
    // Re-encode URI, since it is expected we are emitting a relative URL.
    const resolvedUrl = parseUrl(Uri.file(path).toString());
    resolvedUrl.search = url.search;
    resolvedUrl.hash = url.hash;
    return this.brandAsResolved(urlLibFormat(resolvedUrl));
  }

  relative(fromOrTo: ResolvedUrl, maybeTo?: ResolvedUrl, _kind?: string):
      FileRelativeUrl {
    const [from, to] = (maybeTo !== undefined) ? [fromOrTo, maybeTo] :
                                                 [this.packageUrl, fromOrTo];
    return this.relativeImpl(from, to);
  }

  private relativeImpl(from: ResolvedUrl, to: ResolvedUrl): FileRelativeUrl {
    const pathnameInComponentDir = this.pathnameForComponentDirUrl(to);
    if (pathnameInComponentDir !== undefined) {
      if (this.pathnameForComponentDirUrl(from) === undefined) {
        const componentDirPath =
            pathnameInComponentDir.slice(this.resolvedComponentDir.length);
        const reresolved = this.simpleUrlResolve(
            this.packageUrl, ('../' + componentDirPath) as FileRelativeUrl);
        if (reresolved !== undefined) {
          const reresolvedUrl = parseUrl(reresolved);
          const toUrl = parseUrl(to);
          reresolvedUrl.search = toUrl.search;
          reresolvedUrl.hash = toUrl.hash;
          to = this.brandAsResolved(urlLibFormat(reresolvedUrl));
        }
      }
    }
    return this.simpleUrlRelative(from, to);
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
      if (path && path.startsWith(this.resolvedComponentDir)) {
        return path;
      }
    }
    return undefined;
  }

  private filesystemPathForPathname(decodedPathname: string) {
    return normalizeFsPath(Uri.file(decodedPathname).fsPath);
  }
}

function normalizeFsPath(fsPath: string) {
  fsPath = pathlib.normalize(fsPath);
  if (isWindows && /^[a-z]:/.test(fsPath)) {
    // Upper case the drive letter
    fsPath = fsPath[0].toUpperCase() + fsPath.slice(1);
  }
  return fsPath;
}
