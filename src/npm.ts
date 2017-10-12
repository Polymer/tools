/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import exec, {ExecResult} from './util/exec';
import fs = require('fs');
import path = require('path');
import _util = require('util');
const {promisify} = _util;

export class NpmPackage {
  dir: string;

  constructor(dir: string) {
    this.dir = dir;
  }

  /**
   * Return the current user logged in to npm.
   */
  async whoami(): Promise<string> {
    return (await exec(this.dir, 'npm', ['whoami'])).stdout;
  }

  /**
   * Return the current package manifest. Throws if there are any issues
   * reading/parsing the file contents.
   */
  async getPackageManifest(): Promise<any> {
    const packageManifestLoc = path.join(this.dir, 'package.json');
    const packageManifest =
        await promisify(fs.readFile)(packageManifestLoc, 'utf-8');
    return JSON.parse(packageManifest);
  }

  /**
   * Run `npm publish` in the package directory. A tag name is required
   * (use "latest" to mimic the npm default).
   */
  async publishToNpm(tagName: string): Promise<ExecResult> {
    return exec(this.dir, 'npm', ['publish', '--tag', tagName]);
  }
}
