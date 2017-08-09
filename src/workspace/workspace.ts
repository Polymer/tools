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

import * as nodegit from 'nodegit';

import {GitHubRepo, GitHubRepoRef} from './git';

/**
 * A Workspace represents a local directory and the set of GitHub repository
 * clones in it.
 */
export interface Workspace {
  dir: string;
  repos: Map<string, WorkspaceRepo>;
}

/**
 * A WorkspaceRepo contains all data to specify the git repo and branch to clone
 * and checkout, as well as necessary supporting information from GitHub and
 * local git clone.
 */
export interface WorkspaceRepo {
  /**
   * A relative path like 'repos/paper-input' that points to a
   * directory that contains a pristine checkout of the element as it
   * exists at master.
   */
  dir: string;

  /**
   * Metadata about the elements' github repo, obtained via the GitHub API.
   */
  githubRepo?: GitHubRepo;

  /**
   * The repo+branch ref as requested by tattoo user.
   */
  githubRepoRef: GitHubRepoRef;

  /**
   * The git repo to commit to.
   */
  nodegitRepo?: nodegit.Repository;

  /**
   * Should this repo be tested?
   */
  // test: boolean;
}
