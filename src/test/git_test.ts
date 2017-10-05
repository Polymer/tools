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

import {GitRepo} from '../git';
import exec from '../util/exec';

const rimraf: (dir: string) => void = promisify(_rimraf);


suite('src/git', function() {

  this.timeout(20 * 1000);

  suite('GitRepo', () => {

    const gitDir = path.join(__dirname, 'POLYMER_WORKSPACES_GIT_DIR');
    const emptyDir = path.join(__dirname, 'POLYMER_WORKSPACES_EMPTY_DIR');
    const doesNotExistDir =
        path.join(__dirname, 'POLYMER_WORKSPACES_DOES_NOT_EXIST_DIR');

    setup(async () => {
      mkdirSync(gitDir);
      mkdirSync(emptyDir);
      const gitInitResult = await exec(gitDir, `git`, [`init`]);
      assert.equal(gitInitResult.stderr, '');
    });

    teardown(async () => {
      await rimraf(gitDir);
      await rimraf(emptyDir);
    });

    suite('gitRepo.isGit()', () => {

      test('returns false if current directory does not exist', async () => {
        const doesNotExistGitRepo = new GitRepo(doesNotExistDir);
        assert.isFalse(doesNotExistGitRepo.isGit());
      });

      test('returns false if current directory is not a git repo', async () => {
        const emptyGitRepo = new GitRepo(emptyDir);
        assert.isFalse(emptyGitRepo.isGit());
      });

      test('returns true if current directory is a git repo', async () => {
        const gitRepo = new GitRepo(gitDir);
        assert.isTrue(gitRepo.isGit());
      });

    });

    suite('gitRepo.getHeadSha()', () => {

      test('returns the head SHA for a given git repo', async () => {
        // Empty repos have no HEAD commit. Create one so that this makes sense.
        await exec(
            gitDir, 'git', ['commit', '-m', '"test commit"', '--allow-empty']);
        const gitRepo = new GitRepo(gitDir);
        const gitHeadSha = await gitRepo.getHeadSha();
        assert.isString(gitHeadSha);
        assert.isOk(gitHeadSha.length > 6);
      });

    });

  });
});