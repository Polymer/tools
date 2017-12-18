/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import * as fs from 'fs';
import * as pathlib from 'path';
import Uri from 'vscode-uri';

import {ResolvedUrl} from '../index';
import {PackageRelativeUrl} from '../model/url';

import {UrlLoader} from './url-loader';

/**
 * Resolves requests via the file system.
 */
export class FSUrlLoader implements UrlLoader {
  root: string;

  constructor(root?: string) {
    this.root = root || '';
  }

  canLoad(url: ResolvedUrl): boolean {
    return url.startsWith('file:///');
  }

  load(url: ResolvedUrl): Promise<string> {
    return new Promise((resolve, reject) => {
      const filepath = this.getFilePath(url);
      fs.readFile(filepath, 'utf8', (error: Error, contents: string) => {
        if (error) {
          reject(error);
        } else {
          resolve(contents);
        }
      });
    });
  }

  private getFilePath(url: ResolvedUrl): string {
    if (!this.canLoad(url)) {
      throw new Error(`FsUrlLoader can not load url: ${url}`);
    }
    return Uri.parse(url).fsPath;
  }

  async readDirectory(pathFromRoot: string, deep?: boolean):
      Promise<PackageRelativeUrl[]> {
    const files = await new Promise<string[]>((resolve, reject) => {
      fs.readdir(
          pathlib.join(this.root, pathFromRoot),
          (err, files) => err ? reject(err) : resolve(files));
    });
    const results = [];
    const subDirResultPromises = [];
    for (const basename of files) {
      const file = pathlib.join(pathFromRoot, basename);
      const stat = await new Promise<fs.Stats>(
          (resolve, reject) => fs.stat(
              pathlib.join(this.root, file),
              (err, stat) => err ? reject(err) : resolve(stat)));
      if (stat.isDirectory()) {
        if (deep) {
          subDirResultPromises.push(this.readDirectory(file, deep));
        }
      } else {
        results.push(file as PackageRelativeUrl);
      }
    }
    const arraysOfFiles = await Promise.all(subDirResultPromises);
    for (const dirResults of arraysOfFiles) {
      for (const file of dirResults) {
        results.push(file as PackageRelativeUrl);
      }
    }
    return results;
  }
}
