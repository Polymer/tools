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

declare function require(name: string): any;
try {
  require('source-map-support').install();
} catch (err) {
}

import Bottleneck from 'bottleneck';
// import * as chalk from 'chalk';
import * as child_process from 'child_process';
import * as fs from 'fs';
// import * as GitHub from 'github';
import * as nodegit from 'nodegit';
// import * as pad from 'pad';
import * as path from 'path';
import * as resolve from 'resolve';

import * as git from './git';
// import {test} from './test';
// import {TestResult, TestResultValue} from './test-result';
import * as util from './util';
import {Workspace} from './workspace';

// import promisify = require('promisify-node');
import rimrafCallback = require('rimraf');
import {GitHubRepo} from './git';

const rimraf = (dir: string) => new Promise(
    (resolve, reject) =>
        rimrafCallback(dir, (e) => e === undefined ? resolve() : reject(e)));

/**
 * RunnerOptions contains all configuration used when constructing an instance
 * of the Runner.
 */
export interface RunnerOptions {
  // Use color in the output?
  color?: string;

  // An array of repo expressions for filtering out repos to load.
  excludes?: string[];

  // The github token needed to use the github API.
  githubToken: string;

  // If true, each run will clone new copies of repos instead of updating those
  // already in-place.
  fresh?: boolean;

  // TODO(usergenic): Not Yet Implemented
  // If true, repo clones will be pointed towards last tagged released version
  // instead of the default master branch.  This will not override explicit
  // refs in the  repo expression if present.
  // latestRelease?: boolean;

  // An array of repo expressions defining the set of repos to require/load
  // but not specifically to test.
  requires?: string[];

  // An array of repo expressions representing repos to exclude from testing
  // should any matching ones be encountered in the tests array.
  // skipTests?: string[];

  // An array of repo expressions defining the set of repos to test with the
  // web-component-tester.  Note that repos in this list do not have to be
  // present in the repos array.
  repos: string[];

  // If true, output will information used primarily for debug purposes.
  verbose?: boolean;

  // Command-line flags to send to web-component-tester.
  // wctFlags?: string[];

  // The folder to clone repositories into and run tests from.  Defaults to
  // './tattoo_workspace' if not provided.
  workspaceDir?: string;
}

export class Runner {
  private _color: boolean;

  // The repository patterns we do not want to load.
  private _excludes: string[];

  // Always clone a fresh copy of the repository (don't just update existing
  // clone.)
  private _fresh: boolean;

  private _github: git.GitHubConnection;
  private _requires: string[];
  private _skipTests: string[];
  private _repos: string[];
  private _testRateLimiter: Bottleneck;
  private _verbose: boolean;
  // private _wctFlags: string;
  private _workspace: Workspace;

  // TODO(usergenic): This constructor is getting long.  Break up some of
  // these stanzas into supporting methods.
  constructor(options: RunnerOptions) {
    this._color = options.color !== 'off';
    this._excludes = options.excludes || [];
    this._fresh = !!options.fresh;
    // TODO(usergenic): Pass an option to gitUtil.connectToGitHub for the
    // rate limiter it uses.
    this._github = new git.GitHubConnection(options.githubToken);
    this._requires = options.requires || [];
    // this._skipTests = options.skipTests || [];
    this._repos = options.repos || [];
    this._verbose = !!options.verbose;
    // this._wctFlags = options.wctFlags ? options.wctFlags.join(' ') : '';
    this._workspace = {
      dir: (options.workspaceDir || './tattoo_workspace'),
      repos: new Map()
    };

    // TODO(usergenic): Rate limit should be an option.
    this._testRateLimiter = new Bottleneck(1, 100);

    if (this._verbose) {
      console.log('Tattoo Runner configuration:');
      console.log({
        color: this._color,
        excludes: this._excludes,
        fresh: this._fresh,
        requires: this._requires,
        skipTests: this._skipTests,
        tests: this._repos,
        // wctFlags: this._wctFlags,
        workspaceDir: this._workspace.dir
      });
    }
  }

  /**
   * Given all the repos defined in the workspace, lets iterate through them
   * and either clone them or update their clones and set them to the specific
   * refs.
   */
  async _cloneOrUpdateWorkspaceRepos() {
    const promises: Promise<nodegit.Repository|void>[] = [];
    const checkoutFails: {name: string, error: Error}[] = [];
    const explicitRequires: string[] = this._repos.concat(this._requires);

    // Clone git repos.
    for (const [name, repo] of this._workspace.repos.entries()) {
      promises.push((async () => {
        const repoDir = path.join(this._workspace.dir, repo.dir);
        try {
          const nodegitRepo =
              await this._github.cloneOrFetch(repo.githubRepo!, repoDir);
          repo.nodegitRepo = nodegitRepo;
          // If we don't have a specific checkoutRef, lets leave the repo
          // HEAD pointed to where it's at.
          if (repo.githubRepoRef.checkoutRef) {
            return git.checkoutOriginRef(
                nodegitRepo, repo.githubRepoRef.checkoutRef);
          }
        } catch (error) {
          // TODO(usergenic): Check for the specific error case, but
          // for now we treat these as "the ref doesn't exist".  It
          // is expected that an error could exist if the checkout
          // fails because of local repo changes preventing it as
          // well.
          checkoutFails.push({name, error});
        }
        return undefined;
      })());
    }

    // TODO(usergenic): We probably want to track the set of repos completed so
    // we can identify the problem repos in case error messages come back
    // without enough context for users to debug.
    await util.promiseAllWithProgress(promises, 'Cloning/Updating repos...');


    if (checkoutFails.length > 0) {
      for (const checkoutFail of checkoutFails) {
        const repo = this._workspace.repos.get(checkoutFail.name)!;
        const ref = git.serializeGitHubRepoRef(repo.githubRepoRef);
        if (this._verbose || explicitRequires.includes(ref)) {
          console.log(`Branch not found: ${ref}`);
        }
        const repoDir = path.join(this._workspace.dir, repo.dir);
        await rimraf(repoDir);
        this._workspace.repos.delete(checkoutFail.name);
      }
    }
  }

  /**
   * Given the arrays of repos and tests, expand the set (where wildcards are
   * employed) and then reduce the set with excludes, and set the workspace
   * repos appropriately.
   * TODO(usergenic): This method is getting long.  Break it up into sub-methods
   * perhaps one for expanding the set of repos by going to github etc and
   * another to remove items.
   * TODO(usergenic): Should this method explode if it results in no repos to
   * test?
   */
  async _determineWorkspaceRepos() {
    const excludes: git.GitHubRepoRef[] =
        this._excludes.map(git.parseGitHubRepoRefString);
    // const skipTests: git.GitHubRepoRef[] =
    //     this._skipTests.map(git.parseGitHubRepoRefString);

    // Expand all tests and filter out the excluded repos
    const expandedTests: git.GitHubRepoRef[] =
        (await this._expandWildcardRepoRefs(
             this._repos.map(git.parseGitHubRepoRefString),
             'Searching for repos to test...'))
            .filter(
                (test) => !excludes.some(
                    (exclude) => git.matchRepoRef(exclude, test)));

    // Expand all repos and filter out the excluded repos
    const expandedRepos: git.GitHubRepoRef[] =
        (await this._expandWildcardRepoRefs(
             this._requires.map(git.parseGitHubRepoRefString),
             'Searching for repos to require...'))
            .filter(
                (repo) => !excludes.some(
                    (exclude) => git.matchRepoRef(exclude, repo)));

    // TODO(usergenic): Maybe we should be obtaining the package name here
    // from the repository's bower.json or package.json.

    // Need to download all the GitHub.Repo representations for these.
    const githubRepoRefs: git.GitHubRepoRef[] =
        expandedRepos.concat(expandedTests);

    const githubRepos: GitHubRepo[] =
        <GitHubRepo[]>(
            await util.promiseAllWithProgress(
                githubRepoRefs.map(
                    (repo) =>
                        this._github
                            .getRepoInfo(repo.ownerName!, repo.repoName!)
                            .catch((error) => {
                              if (this._verbose) {
                                console.log(
                                    `Error retrieving information on ${
                                                                       git.serializeGitHubRepoRef(
                                                                           repo)
                                                                     } from GitHub.  ${
                                                                                       error
                                                                                     }`);
                              }
                            })),
                'Getting Repo details from GitHub...'))
            .filter((repo) => !!repo);

    const reposNotFound = [];

    // Build the map of repos by name
    for (const repoRef of githubRepoRefs) {
      // When there is a name collision, we will allow subsequent entries to
      // act as overrides, as long as they represent the same actual repo for
      // the same owner.  We only want to bail if there's a genuine conflict
      // between the repo origins.
      // TODO(usergenic): May want to warn on collisions, just to reduce
      // surprise side effects of bad invocations etc.
      if (this._workspace.repos.has(repoRef.repoName!)) {
        const existingRepo = this._workspace.repos.get(repoRef.repoName!)!;
        if (existingRepo.githubRepoRef.ownerName!.toLowerCase() !==
                repoRef.ownerName!.toLowerCase() ||
            existingRepo.githubRepoRef.repoName!.toLowerCase() !==
                repoRef.repoName!.toLowerCase()) {
          throw new Error(
              `Can not build workspace: more than one repo with name ` +
              ` "${repoRef.repoName}":\n` +
              `  (${
                    git.serializeGitHubRepoRef(existingRepo.githubRepoRef)
                  } and ` +
              `  ${git.serializeGitHubRepoRef(repoRef)})`);
        }
      }
      const githubRepo = githubRepos.find(
          (githubRepo) => git.matchRepoRef(
              git.parseGitHubRepoRefString(githubRepo.full_name), repoRef));
      if (!githubRepo) {
        reposNotFound.push(repoRef);
        continue;
      }
      this._workspace.repos.set(repoRef.repoName!, {
        githubRepoRef: repoRef,
        dir: repoRef.repoName!,
        // test:
        //     (expandedTests.some(test => git.matchRepoRef(test, repoRef)) &&
        //      !skipTests.some(skip => git.matchRepoRef(skip, repoRef))),
        githubRepo: githubRepos.find(
            (githubRepo) => git.matchRepoRef(
                git.parseGitHubRepoRefString(githubRepo.full_name), repoRef))
      });
    }

    for (const repoRef of reposNotFound) {
      console.log(`Repo not found: ${git.serializeGitHubRepoRef(repoRef)}`);
    }
    if (this._verbose) {
      const workspaceReposToTest =
          Array
              .from(this._workspace.repos.entries())
              // .filter(repo => repo[1].test)
              .sort((a, b) => a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0));
      for (const repo of workspaceReposToTest) {
        console.log(
            `Test repo: ${git.serializeGitHubRepoRef(repo[1].githubRepoRef)}`);
      }
      const workspaceReposToRequire =
          Array.from(this._workspace.repos.entries())
              .filter((_repo) => false /*!repo[1].test*/)
              .sort((a, b) => a[0] < b[0] ? -1 : (a[0] > b[0] ? 1 : 0));
      if (workspaceReposToRequire.length > 0) {
        for (const repo of workspaceReposToRequire) {
          console.log(
              `Require repo: ${
                               git.serializeGitHubRepoRef(repo[1].githubRepoRef)
                             }`);
        }
      }
    }
  }

  /**
   * Given a collection of GitHubRepoRefs, replace any that represent wildcard
   * values with the literal values after comparing against names of repos on
   * GitHub.  So a repo ref like `Polymer/*` return everything owned by
   * Polymer where `PolymerElements/iron-*` would be all repos that start with
   * `iron-` owned by `PolymerElements` org.
   */
  async _expandWildcardRepoRefs(
      repoRefs: git.GitHubRepoRef[],
      progressMessage?: string): Promise<git.GitHubRepoRef[]> {
    const ownersToFetchRepoNamesFor: Set<string> = new Set();
    for (const repo of repoRefs) {
      if (repo.repoName!.match(/\*/)) {
        ownersToFetchRepoNamesFor.add(repo.ownerName!.toLowerCase());
      }
    }
    if (ownersToFetchRepoNamesFor.size === 0) {
      return Array.from(repoRefs);
    }

    // const wildcardSearches =
    //     repoRefs.filter((repoRef) => repoRef.repoName.match(/\*/));

    // TODO(usergenic): When there are repos and tests with wildcards, we
    // get two progress bars, identically labeled.  We should move the work to
    // fetch the pages of repos into a support method that can be called in
    // advance of the expand call and put the progress bar message there.
    const allGitHubRepoRefs: git.GitHubRepoRef[] =
        (await util.promiseAllWithProgress(
             Array.from(ownersToFetchRepoNamesFor)
                 .map((owner) => this._github.getRepoFullNames(owner)),
             progressMessage || 'Fetching repo names for wildcard search...'))
            .reduce((a, b) => a.concat(b))
            .map(git.parseGitHubRepoRefString);
    const expandedRepoRefs: git.GitHubRepoRef[] = [];
    for (const repoRef of repoRefs) {
      if (repoRef.repoName!.match(/\*/)) {
        const matchingRefs =
            allGitHubRepoRefs
                .filter(
                    (otherRepoRef) => git.matchRepoRef(repoRef, otherRepoRef))
                .map((otherRepoRef) => {
                  // Set the checkoutRef of the matched repos to the
                  // checkoutRef of the wildcard.
                  return {
                    ownerName: otherRepoRef.ownerName,
                    repoName: otherRepoRef.repoName,
                    checkoutRef: repoRef.checkoutRef
                  };
                });
        if (matchingRefs.length === 0) {
          console.log(`No matches for: ${git.serializeGitHubRepoRef(repoRef)}`);
        }
        expandedRepoRefs.push.apply(expandedRepoRefs, matchingRefs);
      } else {
        expandedRepoRefs.push(repoRef);
      }
    }
    return expandedRepoRefs;
  }

  /**
   * Cleans up the workspace folder and fixes repos which may be in
   * incomplete or bad state due to previous abandoned runs.
   */
  async _prepareWorkspaceFolder() {
    const workspaceDir = this._workspace.dir;

    // Clean up repos when 'fresh' option is true.
    if (this._fresh) {
      if (this._verbose) {
        console.log(`Removing workspace folder ${workspaceDir}...`);
      }
      await rimraf(workspaceDir);
    }

    // Ensure repos folder exists.
    if (!util.existsSync(workspaceDir)) {
      if (this._verbose) {
        console.log(`Creating workspace folder ${workspaceDir}...`);
      }
      fs.mkdirSync(workspaceDir);
    }

    // If a folder exists for a workspace repo and it can't be opened with
    // nodegit, we need to remove it.  This happens when there's not a --fresh
    // invocation and bower installed the dependency instead of git.
    for (const repo of this._workspace.repos) {
      // This only applies to folders which represent github clones.
      if (!repo[1].githubRepoRef) {
        continue;
      }
      const cloneDir = path.join(this._workspace.dir, repo[1].dir);
      if (util.existsSync(cloneDir) &&
          !await git.openRepo(cloneDir).catch((_err) => null)) {
        if (this._verbose) {
          console.log(`Removing existing folder: ${cloneDir}...`);
        }
        await rimraf(cloneDir);
      }
    }
  }

  /**
   * @returns a dictionary object of dev dependencies from the bower.json
   * entries in all workspace repos that are marked for test, suitable for
   * serializing into the devDependencies key of a generated bower.json file
   * for the workspace dir.
   *
   * TODO(usergenic): Merge strategy blindly overwrites previous value for key
   * with whatever new value it encounters as we iterate through bower configs
   * which may not be what we want.  Preserving the
   * highest semver value is *probably* the desired approach
   * instead.
   */
  _mergedTestRepoBowerConfig(): {
    name: string; dependencies: {[key: string]: string};
    resolutions: {[key: string]: string};
  } {
    const merged: {
      name: string; dependencies: {[key: string]: string};
      resolutions: {[key: string]: string};
    } = {
      name: 'generated-bower-config-for-tattoo-workspace',
      dependencies: {},
      resolutions: {}
    };
    for (const repo of Array.from(this._workspace.repos.values())
         /*  .filter(repo => repo.test)*/) {
      const repoPath = path.join(this._workspace.dir, repo.dir);
      // TODO(usergenic): Verify that we can assume bower.json is the config
      // file in the event any repo-specific .bowerrc files are capable of
      // redefining its name.
      const bowerJsonPath = path.join(repoPath, 'bower.json');
      if (!util.existsSync(bowerJsonPath)) {
        continue;
      }
      const bowerJson = fs.readFileSync(bowerJsonPath).toString();
      const bowerConfig = JSON.parse(bowerJson);
      if (bowerConfig.devDependencies) {
        for (const name in bowerConfig.devDependencies) {
          merged.dependencies[name] = bowerConfig.devDependencies[name];
        }
      }
      if (bowerConfig.dependencies) {
        for (const name in bowerConfig.dependencies) {
          merged.dependencies[name] = bowerConfig.dependencies[name];
        }
      }
      if (bowerConfig.resolutions) {
        for (const name in bowerConfig.resolutions) {
          merged.resolutions[name] = bowerConfig.resolutions[name];
        }
      }
      if (bowerConfig.version) {
        merged.resolutions[repo.dir] = bowerConfig.version;
      }
    }
    return merged;
  }

  /**
   * Creates a .bowerrc that tells bower to use the workspace dir (`.`) as
   * the installation dir (instead of default (`./bower_components`) dir.
   * Creates a bower.json which sets all the workspace repos as dependencies
   * and also includes the devDependencies from all workspace repos under test.
   */
  async _installWorkspaceDependencies() {
    const pb =
        util.standardProgressBar('Installing dependencies with bower...', 1);

    fs.writeFileSync(
        path.join(this._workspace.dir, '.bowerrc'), '{"directory": "."}');

    const bowerConfig = this._mergedTestRepoBowerConfig();

    // TODO(usergenic): Verify this is even needed.
    if (!bowerConfig.dependencies['web-component-tester']) {
      bowerConfig.dependencies['web-component-tester'] = '';
    }

    // Make bower config point bower packages of workspace repos to themselves
    // to override whatever any direct or transitive dependencies say.
    for (const repo of Array.from(this._workspace.repos.entries())) {
      const sha = await git.getHeadSha(repo[1].nodegitRepo!);
      bowerConfig.dependencies[repo[0]] = `./${repo[1].dir}#${sha}`;
    }

    fs.writeFileSync(
        path.join(this._workspace.dir, 'bower.json'),
        JSON.stringify(bowerConfig));

    // TODO(usergenic): Can we switch to using bower as library here?  Might
    // even give us better option for progress bar.
    // HACK(usergenic): Need a reliable way to obtain the bower bin script.
    const bowerCmd = path.join(resolve.sync('bower'), '../bin/bower.js');
    child_process.execSync(`node ${bowerCmd} install -F`, {
      // node ${bowerCmd} install`, {
      cwd: this._workspace.dir,
      stdio: (this._verbose ? 'inherit' : 'ignore')
    });
    pb.tick();
  }

  // /**
  //  * All repos specified by tests option will be run through wct.
  //  */
  // async _testAllTheThings(): Promise<TestResult[]> {
  //   const testPromises: Promise<TestResult>[] = [];

  //   for (const repo of Array.from(this._workspace.repos.values())
  //            .filter(repo => repo.test)) {
  //     try {
  //       const testPromise = this._testRateLimiter.schedule(() => {
  //         return test(this._workspace, repo, this._wctFlags.split(' '));
  //       });
  //       testPromises.push(testPromise);
  //     } catch (err) {
  //       throw new Error(
  //           `Error testing ${repo.dir}:\n${err && err.stack || err}`);
  //     }
  //   }

  //   const testCount = testPromises.length;
  //   return await util.promiseAllWithProgress(
  //       testPromises, `Testing ${testCount} repo(s)...`);
  // }

  // async _reportTestResults(testResults: TestResult[]) {
  //   const divider = '---';

  //   if (this._verbose) {
  //     console.log('Report test results...');
  //   }

  //   let passed = 0;
  //   let failed = 0;
  //   let skipped = 0;
  //   let rerun = '#!/bin/bash\n';

  //   // First output the output of tests that failed.
  //   for (const result of testResults) {
  //     if (result.result === TestResultValue.failed) {
  //       const colorFunction = this._color ? chalk.red.inverse : (s) => s;
  //       console.log(divider);
  //       console.log(colorFunction(
  //           `${
  //              git.serializeGitHubRepoRef(result.workspaceRepo.githubRepoRef)
  //            } output:`));
  //       console.log();
  //       console.log(result.output.trim());
  //     }
  //   }

  //   console.log(divider);

  //   const resultBuckets = {PASSED: [], FAILED: [], SKIPPED: []};

  //   // This builds a rerun script and calculates the size of each bucket.
  //   for (const result of testResults) {
  //     let bucketName;
  //     switch (result.result) {
  //       case TestResultValue.passed:
  //         passed++;
  //         bucketName = 'PASSED';
  //         break;
  //       case TestResultValue.failed:
  //         rerun += `pushd ${result.workspaceRepo.dir}\n`;
  //         rerun += `wct\n`;
  //         rerun += `popd\n`;
  //         failed++;
  //         bucketName = 'FAILED';
  //         break;
  //       case TestResultValue.skipped:
  //         skipped++;
  //         bucketName = 'SKIPPED';
  //         break;
  //     }
  //     resultBuckets[bucketName].push(result);
  //   }

  //   for (const bucketName of ['PASSED', 'SKIPPED', 'FAILED']) {
  //     for (const result of resultBuckets[bucketName]) {
  //       let output = `${bucketName}: ${
  //                                      git.serializeGitHubRepoRef(
  //                                          result.workspaceRepo.githubRepoRef)
  //                                    }`;
  //       if (this._color) {
  //         const colorFunction = {
  //           'PASSED': chalk.green,
  //           'SKIPPED': chalk.yellow,
  //           'FAILED': chalk.inverse.red
  //         }[bucketName];
  //         if (colorFunction) {
  //           output = colorFunction(output);
  //         }
  //       }
  //       console.log(output);
  //     }
  //   }

  //   console.log();
  //   const total = passed + failed;
  //   console.log(`${passed} / ${total} tests passed. ${skipped} skipped.`);
  //   if (failed > 0) {
  //     fs.writeFileSync('rerun.sh', rerun, {mode: 0o700});
  //   }

  //   return testResults;
  // }

  // async _convertAllTheThings() {
  //   for (const repo of Array.from(this._workspace.repos.values())) {
  //     console.log(`Converting ${
  //                               repo.githubRepoRef.ownerName
  //                             }/${repo.githubRepoRef.repoName}`);
  //   }
  // }


  /**
   * Works through the sequence of operation, steps in the sequence are
   * encapsulated for clarity but each typically have side-effects on file
   * system or on workspace.
   * TODO(usergenic): Support a --dry-run option.
   */
  async run() {
    // Workspace repo map is empty until we determine what they are.
    await this._determineWorkspaceRepos();
    // Clean up the workspace folder and prepare it for repo clones.
    await this._prepareWorkspaceFolder();
    // Update in-place and/or clone repositories from GitHub.
    await this._cloneOrUpdateWorkspaceRepos();

    // If it turns out there are no repos in the workspace to test, we can
    // stop here.
    // if (!Array.from(this._workspace.repos.values()).some((repo) =>
    // repo.test)) {
    //   console.log('No repos to test.  Exiting.  (Run tattoo -h for help)');
    //   return;
    // }
    // Bower installs all the devDependencies of test repos also gets wct.
    await this._installWorkspaceDependencies();

    return this._workspace;

    // await this._convertAllTheThings();

    // // Run all the tests.  (sort by dir)
    // const testResults = (await this._testAllTheThings()).sort((a, b) => {
    //   const ad = git.serializeGitHubRepoRef(a.workspaceRepo.githubRepoRef),
    //         bd = git.serializeGitHubRepoRef(b.workspaceRepo.githubRepoRef);
    //   return ad < bd ? -1 : ad > bd ? 1 : 0;
    // });
    // // Report test results.
    // this._reportTestResults(testResults);
  }
}
