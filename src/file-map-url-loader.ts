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

import File = require('vinyl');
import {UrlLoader} from 'polymer-analyzer/lib/url-loader/url-loader';
import {parseUrl} from 'polymer-analyzer/lib/utils';
import {pathFromUrl} from './path-transformers';

/**
 * A map of paths to Files.
 */
export type FileMap = Map<string, File>;

/**
 * This is a `UrlLoader` for use with a `polymer-analyzer` that reads files
 * that have been gathered by a `BuildBundler` transform stream.
 */
export class FileMapUrlLoader implements UrlLoader {
  root: string;
  files: FileMap;

  constructor(root: string, files: FileMap) {
    this.root = root;
    this.files = files;
  }

  _filePath(url: string): string {
    const urlObject = parseUrl(url);
    const urlPath = decodeURIComponent(urlObject.pathname);
    return pathFromUrl(this.root, urlPath);
  }

  // We can always return true because we're just reading paths off a map.
  canLoad(_url: string): boolean {
    return true;
  }

  async load(url: string): Promise<string> {
    const file = this.files.get(this._filePath(url))!;

    if (file) {
      return Promise.resolve(file.contents.toString());
    } else {
      return Promise.reject(undefined);
    }
  }
}
