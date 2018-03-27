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

import chalk from 'chalk';
import * as fse from 'fs-extra';
import * as inquirer from 'inquirer';
import * as path from 'path';
import {run, WorkspaceRepo} from 'polymer-workspaces';

import {NpmImportStyle} from './conversion-settings';
import {ConversionResultsMap, GIT_STAGING_BRANCH_NAME, WorkspaceConversionSettings} from './convert-workspace';
import {YarnConfig} from './npm-config';
import {generatePackageJson, localDependenciesBranch, writeJson} from './package-manifest';
import {lookupNpmPackageName} from './urls/workspace-url-handler';
import {exec, logRepoError, logStep, readJsonIfExists} from './util';

/**
 * Configuration options required for workspace testing. Same as conversion
 * settings.
 */
interface WorkspaceTestSettings extends WorkspaceConversionSettings {
  importStyle: NpmImportStyle;
}

/**
 * Setup the workspace repos for testing. Be sure to call restoreRepos() after
 * testing is complete.
 */
async function setupRepos(
    reposUnderTest: WorkspaceRepo[],
    localConversionMap: ConversionResultsMap,
    options: WorkspaceTestSettings) {
  return run(reposUnderTest, async (repo) => {
    await exec(repo.dir, 'git', ['checkout', '-B', localDependenciesBranch]);
    await writeTestingPackageJson(repo, localConversionMap, options);
    await exec(
        repo.dir, 'git', ['commit', '-am', 'testing commit', '--allow-empty']);
  }, {concurrency: 10});
}

/**
 * Run `yarn install` to install dependencies in a repo. Note that this creates
 * a node_modules/ folder & an associated yarn.lock file as side effects.
 */
async function installNpmDependencies(repo: WorkspaceRepo) {
  // TODO(fks): Get `yarn install --flat` working to test flat install
  // See: https://github.com/Polymer/polymer-modulizer/issues/254
  return exec(repo.dir, 'npm', ['install']);
}

/**
 * Run `wct --npm` in a repo.
 */
async function testRepo(repo: WorkspaceRepo, wctFlags: string[]) {
  const repoDirName = path.basename(repo.dir);
  const results = await exec(repo.dir, 'wct', wctFlags);
  if (results.stdout.length > 0) {
    console.log(chalk.dim(`${repoDirName}: ${results.stdout}`));
  }
  if (results.stderr.length > 0) {
    console.log(chalk.red(`${repoDirName}: ${results.stderr}`));
  }
  return results;
}

/**
 * Restore the repos to their proper state.
 */
async function restoreRepos(reposUnderTest: WorkspaceRepo[]) {
  return run(reposUnderTest, async (repo) => {
    await repo.git.destroyAllUncommittedChangesAndFiles();
    await repo.git.checkout(GIT_STAGING_BRANCH_NAME);
  }, {concurrency: 10});
}

/**
 * For a given repo, generate a new package.json and write it to disk. This
 * is a testing-specific package.json manifest, which means that it will
 * include local references to dependencies that were also converted in the
 * workspace.
 */
async function writeTestingPackageJson(
    repo: WorkspaceRepo,
    localConversionMap: Map<string, string>,
    options: WorkspaceTestSettings) {
  const bowerPackageName = path.basename(repo.dir);
  const bowerJsonPath = path.join(repo.dir, 'bower.json');
  const bowerJson = await fse.readJSON(bowerJsonPath);
  const npmPackageName =
      lookupNpmPackageName(bowerJsonPath) || bowerPackageName;

  const packageJsonPath = path.join(repo.dir, 'package.json');
  const existingPackageJson =
      await readJsonIfExists<Partial<YarnConfig>>(packageJsonPath);

  const packageJson = generatePackageJson(
      bowerJson,
      {
        name: npmPackageName,
        version: options.packageVersion,
        flat: options.flat,
        private: options.private,
      },
      localConversionMap,
      existingPackageJson);
  writeJson(packageJson, packageJsonPath);
}

export async function testWorkspace(
    localConversionMap: Map<string, string>, options: WorkspaceTestSettings) {
  const {wctFlagsRaw} = await inquirer.prompt([
    {
      type: 'input',
      name: 'wctFlagsRaw',
      message: 'wct flags:',
      default: (options.importStyle === 'path') ?
          '--npm' :
          '--npm --module-resolution=node',
    },
  ]);

  const allRepos = options.reposToConvert;
  const wctFlags: string[] = wctFlagsRaw.split(/\s+/);

  logStep(1, 4, '🔧', `Preparing Repos...`);
  const setupRepoResults =
      await setupRepos(allRepos, localConversionMap, options);
  setupRepoResults.failures.forEach(logRepoError);

  logStep(2, 4, '🔧', `Running Tests...`);
  const runResults =
      await run([...setupRepoResults.successes.keys()], async (repo) => {
        try {
          await installNpmDependencies(repo);
          return await testRepo(repo, wctFlags);
        } catch (err) {
          logRepoError(err, repo);
          throw err;
        }
      }, {concurrency: 1});

  logStep(3, 4, '🔧', `Restoring Repos...`);
  const restoreResults = await restoreRepos(allRepos);
  restoreResults.failures.forEach(logRepoError);

  logStep(4, 4, '🔧', `Tests Complete!`);
  return [...runResults.successes.keys()];
}

export async function testWorkspaceInstallOnly(
    localConversionMap: Map<string, string>, options: WorkspaceTestSettings) {
  const allRepos = options.reposToConvert;

  logStep(1, 4, '🔧', `Preparing Repos...`);
  const setupRepoResults =
      await setupRepos(allRepos, localConversionMap, options);
  setupRepoResults.failures.forEach(logRepoError);

  logStep(2, 4, '🔧', `Installing Dependencies...`);
  const runResults =
      await run([...setupRepoResults.successes.keys()], async (repo) => {
        try {
          return await installNpmDependencies(repo);
        } catch (err) {
          logRepoError(err, repo);
          throw err;
        }
      }, {concurrency: 1});

  logStep(3, 4, '🔧', `Restoring Repos...`);
  const restoreResults = await restoreRepos(allRepos);
  restoreResults.failures.forEach(logRepoError);

  logStep(4, 4, '🔧', `Tests Complete!`);
  return [...runResults.successes.keys()];
}
