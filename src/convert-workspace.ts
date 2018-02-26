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

import * as fse from 'fs-extra';
import * as path from 'path';
import {Analyzer, FSUrlLoader, InMemoryOverlayUrlLoader, PackageUrlResolver, ResolvedUrl} from 'polymer-analyzer';
import {run, WorkspaceRepo} from 'polymer-workspaces';

import {BowerConfig} from './bower-config';
import {createDefaultConversionSettings, PartialConversionSettings} from './conversion-settings';
import {generatePackageJson, writeJson} from './manifest-converter';
import {YarnConfig} from './npm-config';
import {ProjectConverter} from './project-converter';
import {polymerFileOverrides} from './special-casing';
import {lookupNpmPackageName, WorkspaceUrlHandler} from './urls/workspace-url-handler';
import {deleteGlobsSafe, exec, logRepoError, readJsonIfExists, writeFileResults} from './util';

/**
 * Configuration options required for workspace conversions. Contains
 * information about which repos to convert and what new version to set
 * each npm package at.
 */
export interface WorkspaceConversionSettings extends PartialConversionSettings {
  packageVersion: string;
  workspaceDir: string;
  reposToConvert: WorkspaceRepo[];
}

export const GIT_STAGING_BRANCH_NAME = 'polymer-modulizer-staging';

/**
 * For a given repo, generate a new package.json and write it to disk.
 */
async function writePackageJson(
    repo: WorkspaceRepo,
    options: {version: string, flat: boolean, private: boolean}) {
  const bowerPackageName = path.basename(repo.dir);
  const bowerJsonPath = path.join(repo.dir, 'bower.json');
  const bowerJson = fse.readJSONSync(bowerJsonPath) as Partial<BowerConfig>;
  const npmPackageName =
      lookupNpmPackageName(bowerJsonPath) || bowerPackageName;

  const packageJsonPath = path.join(repo.dir, 'package.json');
  const existingPackageJson =
      await readJsonIfExists<Partial<YarnConfig>>(packageJsonPath);

  const packageJson = generatePackageJson(
      bowerJson,
      {name: npmPackageName, ...options},
      undefined,
      existingPackageJson);
  writeJson(packageJson, packageJsonPath);
}

/**
 * Configure a basic analyzer instance for the workspace.
 */
function configureAnalyzer(options: WorkspaceConversionSettings) {
  const workspaceDir = options.workspaceDir;
  const urlResolver = new PackageUrlResolver({packageDir: workspaceDir});
  const urlLoader = new InMemoryOverlayUrlLoader(new FSUrlLoader(workspaceDir));
  for (const [url, contents] of polymerFileOverrides) {
    urlLoader.urlContentsMap.set(
        urlResolver.resolve(`polymer/${url}` as ResolvedUrl)!, contents);
  }
  return new Analyzer({
    urlLoader,
    urlResolver,
  });
}

/**
 * The results of a conversion, as a map of converted package npm names -> their
 * full file path location on disk.
 */
export type ConversionResultsMap = Map<string, string>;

/**
 * Convert a set of workspace repos to npm packages and JavaScript modules.
 * Returns a map of all packages converted, keyed by npm package name.
 */
export default async function convert(options: WorkspaceConversionSettings):
    Promise<ConversionResultsMap> {
  const analyzer = configureAnalyzer(options);
  const analysis = await analyzer.analyzePackage();
  const conversionSettings =
      createDefaultConversionSettings(analyzer, analysis, options);
  const urlHandler = new WorkspaceUrlHandler(analyzer, options.workspaceDir);
  const converter =
      new ProjectConverter(analysis, urlHandler, conversionSettings);
  const scannedPackageResults: ConversionResultsMap = new Map();

  // For each repo, convert the full package:
  for (const repo of options.reposToConvert) {
    const repoDirName = path.basename(repo.dir);
    const bowerConfigPath = path.join(repo.dir, 'bower.json');
    const npmPackageName = lookupNpmPackageName(bowerConfigPath);
    if (!npmPackageName) {
      continue;
    }
    scannedPackageResults.set(npmPackageName, repo.dir);
    converter.convertPackage(repoDirName);
  }

  // Process & write each conversion result:
  const results = converter.getResults();
  await writeFileResults(options.workspaceDir, results);

  // Delete files that were explicitly requested to be deleted. Note we apply
  // the glob with each repo as the root directory (e.g. a glob of "types"
  // will delete "types" from each individual repo).
  if (options.deleteFiles !== undefined) {
    for (const repo of options.reposToConvert) {
      await deleteGlobsSafe(options.deleteFiles, repo.dir);
    }
  }

  // Generate a new package.json for each repo:
  const packageJsonResults = await run(
      options.reposToConvert, async (repo) => await writePackageJson(repo, {
                                version: options.packageVersion,
                                flat: options.flat,
                                private: options.private,
                              }));
  packageJsonResults.failures.forEach(logRepoError);

  // Commit all changes to a staging branch for easy state resetting.
  // Useful when performing actions that modify the repo, like installing deps.
  const commitResults = await run(options.reposToConvert, async (repo) => {
    await repo.git.createBranch(GIT_STAGING_BRANCH_NAME);
    await exec(repo.dir, 'git', ['add', '-A']);
    // TODO(fks): Add node_modules to .gitignore, if not found
    // https://github.com/Polymer/polymer-modulizer/issues/250
    await exec(repo.dir, 'git', ['reset', '--', 'node_modules/']);
    await repo.git.commit('auto-converted by polymer-modulizer');
  });
  commitResults.failures.forEach(logRepoError);

  // Return a map of all packages converted, keyed by npm package name.
  return scannedPackageResults;
}
