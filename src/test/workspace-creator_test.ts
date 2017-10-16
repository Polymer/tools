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

// NOTE(fks) 09-22-2017: The WorkspaceCreator object is meant to wrap a lot of
// complex functionality together, including repo fetching, cloning, and running
// logic across multiple directories.
//
// While the smaller pieces this object relies on are tested individually,
// there is no way to unit test the WorkspaceCreator object without making
// private implementation-detail methods public, which is exactly what we're
// trying to avoid.
//
// TODO(fks) 09-22-2017: Write some good integration tests instead.

import {assert} from 'chai';
import path = require('path');
import {WorkspaceCreator} from '../workspace-creator';

const testGitHubToken = 'TEST_GITHUB_TOKEN';
const testWorkspaceDir = path.join(__dirname, 'TEST_WORKSPACE_DIR');

suite('src/workspace-creator', function() {

  suite('WorkspaceCreator', () => {

    suite('workspace.init()', () => {

      test('can be initialized with an empty set of patterns', async () => {
        const workspace = new WorkspaceCreator(
            {token: testGitHubToken, dir: testWorkspaceDir});
        const {workspaceRepos, failures} = await workspace.init({include: []});
        assert.deepEqual(workspaceRepos, []);
        assert.deepEqual([...failures], []);
      });

    });

  });

});
