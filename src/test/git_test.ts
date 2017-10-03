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

import {assert} from 'chai';
import {mkdirSync} from 'fs';
import {promisify} from 'util';
import path = require('path');
import _rimraf = require('rimraf');

import {GitSession} from '../git';
import exec from '../util/exec';

const rimraf: (dir: string) => void = promisify(_rimraf);


suite('src/git', function() {

  this.timeout(20 * 1000);

  suite('GitSession', () => {

    const testDir = path.join(__dirname, 'POLYMER_WORKSPACES_GIT_TEST_DIR');
    let gitSession: GitSession;

    setup(async () => {
      await rimraf(testDir);
      gitSession = new GitSession(testDir);
    });

    suiteTeardown(async () => {
      return await rimraf(testDir);
    });

    suite('gitSession.isGit()', () => {

      test('returns false if current directory does not exist', async () => {
        assert.isFalse(gitSession.isGit());
      });

      test('returns false if current directory is not a git repo', async () => {
        mkdirSync(testDir);
        assert.isFalse(gitSession.isGit());
      });

      test('returns true if current directory is a git repo', async () => {
        mkdirSync(testDir);
        const result = await exec(testDir, `git`, [`init`]);
        assert.equal(result.stderr, '');
        assert.isTrue(gitSession.isGit());
      });

    });

  });
});