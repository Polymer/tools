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
import fs = require('fs');
import util = require('util');
import path = require('path');
import _rimraf = require('rimraf');

import {GitRepo} from '../git';
import exec from '../util/exec';

const rimraf: (dir: string) => void = util.promisify(_rimraf);

suite('src/git', function() {
  this.timeout(20 * 1000);

  suite('GitRepo', () => {
    const gitDir = path.join(__dirname, 'POLYMER_WORKSPACES_GIT_DIR');
    const emptyDir = path.join(__dirname, 'POLYMER_WORKSPACES_EMPTY_DIR');
    const doesNotExistDir =
        path.join(__dirname, 'POLYMER_WORKSPACES_DOES_NOT_EXIST_DIR');

    setup(async () => {
      fs.mkdirSync(gitDir);
      fs.mkdirSync(emptyDir);
      const gitInitResult = await exec(gitDir, `git`, [`init`]);
      assert.equal(gitInitResult.stderr, '');
      const gitCommitResult = await exec(
          gitDir, `git`, [`commit`, `--allow-empty`, `-m`, `"testing"`]);
      assert.equal(gitCommitResult.stderr, '');
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
        const gitRepo = new GitRepo(gitDir);
        const gitHeadSha = await gitRepo.getHeadSha();
        assert.isString(gitHeadSha);
        assert.isOk(gitHeadSha.length > 6);
      });
    });

    suite('gitRepo.createBranch()', async () => {
      test('creates a new branch in the git repo', async () => {
        const gitRepo = new GitRepo(gitDir);
        await gitRepo.createBranch('abcdefgh');
        const getBranchNameResult = await exec(gitDir, 'git', ['status']);
        assert.include(getBranchNameResult.stdout, 'On branch abcdefgh');
      });
    });

    suite('gitRepo.checkout()', async () => {
      test('creates a new branch in the git repo', async () => {
        const gitRepo = new GitRepo(gitDir);
        await exec(gitDir, 'git', ['checkout', '-b', 'branch-1']);
        await exec(gitDir, 'git', ['checkout', '-b', 'branch-2']);
        const getBranch2NameResult = await exec(gitDir, 'git', ['status']);
        assert.include(getBranch2NameResult.stdout, 'On branch branch-2');
        await gitRepo.checkout('branch-1');
        const getBranch1NameResult = await exec(gitDir, 'git', ['status']);
        assert.include(getBranch1NameResult.stdout, 'On branch branch-1');
      });
    });
  });
});