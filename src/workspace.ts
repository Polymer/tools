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

import fs = require('fs');
import path = require('path');
import util = require('util');

import {GitRepo} from './git';
import {NpmPackage} from './npm';
import {GitHubConnection, GitHubRepo, GitHubRepoReference} from './github';
import {mergedBowerConfigsFromRepos} from './util/bower';
import exec, {checkCommand} from './util/exec';
import {existsSync} from './util/fs';

import _rimraf = require('rimraf');
const rimraf: (dir: string) => void = util.promisify(_rimraf);

interface GitHubRepoError {
  error: Error;
  repoReference: GitHubRepoReference;
}

/**
 * When running a batch process, return an array of two items: the
 * WorkspaceRepos where the until of work completed successfully, and a Map of
 * all WorkspaceRepos where the work failed (pointing to the thrown Error in
 * each directory).
 */
export type BatchProcessResponse = [WorkspaceRepo[], Map<WorkspaceRepo, Error>];

/**
 * A WorkspaceRepo contains all data to specify the github repo, as well as
 * an active session to interact with the local git repository.
 */
export interface WorkspaceRepo {
  dir: string;
  git: GitRepo;
  npm: NpmPackage;
  github: GitHubRepo;
}

export interface WorkspaceInitOptions {
  fresh?: boolean;
  verbose?: boolean;
}

export class Workspace {
  dir: string;
  private _github: GitHubConnection;
  private _initializedRepos: WorkspaceRepo[]|undefined;

  constructor(options: {token: string, dir: string}) {
    this.dir = options.dir;
    this._github = new GitHubConnection(options.token);
  }

  /**
   * Helper function that returns true when workspace.init() has been run.
   */
  get isInitialized() {
    return !!this._initializedRepos;
  }

  /**
   * Helper function that throws an error when workspace has not yet been
   * initialized.
   */
  private assertInitialized() {
    if (!this.isInitialized) {
      throw new Error('Workspace has not been initialized, run init() first.');
    }
  }

  /**
   * Given the arrays of repos patterns, expand the set (where wildcards are
   * employed) and then reduce the set with excludes, and set the workspace
   * repos appropriately.
   */
  private async _determineGitHubRepos(
      repoPatterns: string[], excludes: string[] = []): Promise<GitHubRepo[]> {
    excludes = excludes.map(String.prototype.toLowerCase);

    let repoRefs: GitHubRepoReference[] =
        await this._github.expandRepoPatterns(repoPatterns);
    repoRefs = repoRefs.filter(
        (repoRef) => !excludes.includes(repoRef.fullName.toLowerCase()));

    const githubReposMaybe: Array<GitHubRepo|GitHubRepoError> =
        await Promise.all(repoRefs.map(async (repoRef) => {
          try {
            return await this._github.getRepoInfo(repoRef);
          } catch (err) {
            return {error: err, repoReference: repoRef};
          }
        }));

    return githubReposMaybe.filter((repoResponse) => {
      if ((repoResponse as GitHubRepoError).error) {
        const {fullName} = (repoResponse as GitHubRepoError).repoReference;
        const {message} = (repoResponse as GitHubRepoError).error;
        console.log(`Repo not found: ${fullName} (${message})`);
        return null;
      }
      return true;
    }) as GitHubRepo[];
  }

  /**
   * Create a new WorkspaceRepo -- includes an active GitRepo session - for a
   * given GitHubRepo object.
   */
  private _openWorkspaceRepo(repo: GitHubRepo): WorkspaceRepo {
    const sessionDir = path.resolve(this.dir, repo.name);
    return {
      dir: sessionDir,
      git: new GitRepo(sessionDir),
      npm: new NpmPackage(sessionDir),
      github: repo,
    };
  }

  /**
   * Cleans up the workspace folder and fixes repos which may be in
   * incomplete or bad state due to previous abandoned runs.
   */
  private async _prepareWorkspaceFolders(
      repos: WorkspaceRepo[], options: WorkspaceInitOptions = {}) {
    const workspaceDir = this.dir;

    // Clean up repos when 'fresh' option is true.
    if (options.fresh) {
      if (options.verbose) {
        console.log(`Removing workspace folder ${workspaceDir}...`);
      }
      await rimraf(workspaceDir);
    }

    // Ensure repos folder exists.
    if (!existsSync(workspaceDir)) {
      if (options.verbose) {
        console.log(`Creating workspace folder ${workspaceDir}...`);
      }
      fs.mkdirSync(workspaceDir);
    }

    // If a folder exists for a workspace repo and it can't be opened with
    // nodegit, we need to remove it.  This happens when there's not a --fresh
    // invocation and bower installed the dependency instead of git.
    for (const repo of repos) {
      if (existsSync(repo.dir) && !repo.git.isGit()) {
        if (options.verbose) {
          console.log(`Removing existing folder: ${repo.dir}...`);
        }
        await rimraf(repo.dir);
      }
    }
  }

  /**
   * Given all the repos defined in the workspace, lets iterate through them
   * and either clone them or update their clones and set them to the specific
   * refs.
   * TODO(fks) 09-25-2017: Better error handling. Standardize/format errors
   * so that single type of error thrown.
   */
  private async _cloneOrUpdateWorkspaceRepos(repos: WorkspaceRepo[]) {
    for (const repo of repos) {
      if (repo.git.isGit()) {
        await repo.git.fetch();
        await repo.git.destroyAllUncommittedChangesAndFiles();
      } else {
        await repo.git.clone(repo.github.cloneUrl);
      }
      await repo.git.checkout(repo.github.ref || repo.github.defaultBranch);
    }
  }

  /**
   * Creates a .bowerrc that tells bower to use the workspace dir (`.`) as
   * the installation dir (instead of default (`./bower_components`) dir.
   * Creates a bower.json which sets all the workspace repos as dependencies
   * and also includes the devDependencies from all workspace repos under test.
   */
  private async _configureBowerWorkspace(repos: WorkspaceRepo[]) {
    fs.writeFileSync(path.join(this.dir, '.bowerrc'), '{"directory": "."}');

    const bowerConfig = mergedBowerConfigsFromRepos(repos);

    // Make bower config point bower packages of workspace repos to themselves
    // to override whatever any direct or transitive dependencies say.
    for (const repo of repos) {
      const sha = await repo.git.getHeadSha();
      bowerConfig.dependencies[repo.github.name] =
          `./${repo.github.name}#${sha}`;
    }

    fs.writeFileSync(
        path.join(this.dir, 'bower.json'), JSON.stringify(bowerConfig));
  }

  /**
   * Creates a .bowerrc that tells bower to use the workspace dir (`.`) as
   * the installation dir (instead of default (`./bower_components`) dir.
   * Creates a bower.json which sets all the workspace repos as dependencies
   * and also includes the devDependencies from all workspace repos under test.
   */
  private async _installWorkspaceDependencies() {
    await exec(this.dir, `bower`, ['install', '-F'], {maxBuffer: 1000 * 1024});
  }

  /**
   * Validate your environment/workspace/context before running. Throw if bad.
   */
  private async _initValidate() {
    if (this.isInitialized) {
      throw new Error('Workspace has already been initialized.');
    }
    if (!(await checkCommand('git'))) {
      throw new Error(
          'polymer-workspace: global "git" command not found. Install git on your machine and then retry.');
    }
    if (!(await checkCommand('bower'))) {
      throw new Error(
          'polymer-workspace: global "bower" command not found. Install bower on your machine and then retry.');
    }
    if (!(await checkCommand('npm'))) {
      throw new Error(
          'polymer-workspace: global "npm" command not found. Install npm on your machine and then retry.');
    }
  }

  /**
   * Initialize the Workspace. This is the driver of all initialization and
   * setup logic.
   */
  async init(
      patterns: {include: string[], exclude?: string[]},
      options?: WorkspaceInitOptions): Promise<WorkspaceRepo[]> {
    await this._initValidate();
    // Fetch our repos from the given patterns.
    const githubRepos =
        await this._determineGitHubRepos(patterns.include, patterns.exclude);
    const workspaceRepos = githubRepos.map((r) => this._openWorkspaceRepo(r));
    // Clean up the workspace folder and prepare it for repo clones.
    await this._prepareWorkspaceFolders(workspaceRepos, options);
    // Update in-place and/or clone repositories from GitHub.
    await this._cloneOrUpdateWorkspaceRepos(workspaceRepos);
    // Setup Bower and install all required dependencies.
    await this._configureBowerWorkspace(workspaceRepos);
    await this._installWorkspaceDependencies();
    // All done!
    this._initializedRepos = workspaceRepos;
    return workspaceRepos;
  }

  /**
   * Run some function of work over each workspace repo, returning a collection
   * of successes and failures for each run.
   */
  async run(
      workspaceRepos: WorkspaceRepo[],
      fn: (repo: WorkspaceRepo) => Promise<void>):
      Promise<BatchProcessResponse> {
    this.assertInitialized();
    const successRuns = [];
    const failRuns = new Map<WorkspaceRepo, Error>();
    for (const workspaceRepo of workspaceRepos) {
      try {
        await fn(workspaceRepo);
        successRuns.push(workspaceRepo);
      } catch (err) {
        failRuns.set(workspaceRepo, err);
      }
    }
    return [successRuns, failRuns];
  }

  /**
   * Create a new branch on each repo.
   */
  async startNewBranch(workspaceRepos: WorkspaceRepo[], newBranch: string) {
    this.assertInitialized();
    await Promise.all(workspaceRepos.map((repo) => {
      return repo.git.createBranch(newBranch);
    }));
  }

  /**
   * Commit changes on each repo with the given commit message.
   */
  async commitChanges(workspaceRepos: WorkspaceRepo[], message: string) {
    this.assertInitialized();
    await Promise.all(workspaceRepos.map((repo) => {
      return repo.git.commit(message);
    }));
  }

  /**
   * Push the current repo HEAD to the given `pushToBranch` branch on GitHub.
   */
  async pushChangesToGithub(
      workspaceRepos: WorkspaceRepo[], pushToBranch?: string,
      forcePush = false) {
    this.assertInitialized();
    await Promise.all(workspaceRepos.map((repo) => {
      return repo.git.pushCurrentBranchToOrigin(pushToBranch, forcePush);
    }));
  }

  /**
   * (Not Yet Implemented) Publish a new version to NPM.
   */
  async publishPackagesToNpm(
      workspaceRepos: WorkspaceRepo[], distTag = 'latest') {
    if (!this._initializedRepos) {
      throw new Error('Workspace has not been initialized, run init() first.');
    }
    // TODO(fks) 10-12-2017: Convert to a batch processer flow that doesn't halt
    // on first error.
    await Promise.all(
        workspaceRepos.map((repo) => repo.npm.publishToNpm(distTag)));
  }
}
