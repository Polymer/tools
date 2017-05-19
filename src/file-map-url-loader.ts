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
import {UrlLoader} from 'polymer-analyzer';
import {parseUrl} from 'polymer-analyzer/lib/core/utils';
import {getFileContents} from './streams';

/**
 * This is a `UrlLoader` for use with a `polymer-analyzer` that reads files
 * that have been gathered by a `BuildBundler` transform stream.
 */
export class FileMapUrlLoader implements UrlLoader {
  files: Map<string, File>;
  fallbackLoader?: UrlLoader;

  constructor(files: Map<string, File>, fallbackLoader?: UrlLoader) {
    this.files = files;
    this.fallbackLoader = fallbackLoader;
  }

  // Return true if we can return load the given url.
  canLoad(url: string): boolean {
    return this.files.has(url) ||
        this.fallbackLoader && this.fallbackLoader.canLoad(url);
  }

  // Try to load the file from the map.  If not in the map, try to load
  // from the fallback loader.
  async load(url: string): Promise<string> {
    const file = this.files.get(parseUrl(url).pathname)!;

    if (file == null) {
      if (this.fallbackLoader) {
        if (this.fallbackLoader.canLoad(url)) {
          return this.fallbackLoader.load(url);
        }
        throw new Error(
            `${url} not present in file map and fallback loader can not load.`);
      }
      throw new Error(`${url} not present in file map and no fallback loader.`);
    }

    return getFileContents(file);
  }
}
