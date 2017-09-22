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

import * as path from 'path';

import exec from './util/exec';
import {existsSync} from './util/fs';

export class GitSession {
  cwd: string;

  constructor(cwd: string) {
    this.cwd = cwd;
  }

  /**
   * Returns true if directory exists and its own git repo.
   */
  isGit(): boolean {
    return existsSync(path.join(this.cwd, '.git'));
  }

  /**
   * Returns the git commit hash at HEAD.
   */
  async getHeadSha(): Promise<string> {
    return (await exec(this.cwd, `git rev-parse HEAD`))[0];
  }

  /**
   * Run `git clone [url] [this.cwd]`.
   */
  async clone(url: string): Promise<string> {
    return (await exec(process.cwd(), `git clone ${url} ${this.cwd}`))[0];
  }

  /**
   * Run `git fetch [remoteName]`. If remoteName is not given, git will fetch
   * from default.
   */
  async fetch(remoteName: string = ''): Promise<string> {
    return (await exec(this.cwd, `git fetch ${remoteName}`))[0];
  }

  /**
   * Run `git checkout [branch]`.
   */
  async checkout(branch: string): Promise<string> {
    return (await exec(this.cwd, `git checkout ${branch} --`))[0];
  }

  /**
   * Resets the repo back to a clean state. Note that this deletes any
   * uncommitted changes and untracked files in the repo directory, created
   * through tooling or otherwise.
   */
  async destroyAllUncommittedChangesAndFiles(): Promise<void> {
    await exec(this.cwd, `git reset --hard`);
    await exec(this.cwd, `git clean -fd`);
  }
}
