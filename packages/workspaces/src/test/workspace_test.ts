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

// NOTE(fks) 09-22-2017: The Workspace object is meant to wrap a lot of complex
// functionality together related to setup, including repo fetching, cloning,
// and resetting.
//
// While the smaller pieces this object relies on are tested individually,
// there is no way to unit test the Workspace object without making
// private implementation-detail methods public, which is exactly what we're
// trying to avoid.
//
// TODO(fks) 09-22-2017: Write some good integration tests instead.

import {assert} from 'chai';
import path = require('path');
import {Workspace} from '../workspace';
import * as mockApi from './_util/mock-api';
import {testApiToken} from './_util/mock-api';

const testWorkspaceDir = path.join(__dirname, 'TEST_WORKSPACE_DIR');

suite('src/workspace', function() {
  suite('Workspace', () => {
    suiteSetup(() => {
      mockApi.setup();
    });

    suiteTeardown(() => {
      mockApi.teardown();
    });

    suite('workspace.init()', () => {
      test('can be initialized with an empty set of patterns', async () => {
        const workspace = new Workspace(
            {token: testApiToken, dir: testWorkspaceDir, match: []});
        const {workspaceRepos, failures} = await workspace.init();
        assert.deepEqual(workspaceRepos, []);
        assert.deepEqual([...failures], []);
      });
    });

    suite('workspace._determineGitHubRepos()', () => {
      test(
          'succesfully determines repos for a set of patterns to match',
          async () => {
            const workspace = new Workspace({
              token: testApiToken,
              dir: testWorkspaceDir,
              match: ['PolymerElements/paper-*']
            });
            const repos = await workspace._determineGitHubRepos();
            assert.deepEqual(repos.map((r) => r.fullName), [
              'PolymerElements/paper-appbar',
              'PolymerElements/paper-button'
            ]);
          });

      test(
          'succesfully determines repos for sets of patterns to match and exclude',
          async () => {
            const workspace = new Workspace({
              token: testApiToken,
              dir: testWorkspaceDir,
              match: ['PolymerElements/paper-*'],
              exclude: ['PolymerElements/paper-button']
            });
            const repos = await workspace._determineGitHubRepos();
            assert.deepEqual(
                repos.map((r) => r.fullName), ['PolymerElements/paper-appbar']);
          });
    });
  });
});
