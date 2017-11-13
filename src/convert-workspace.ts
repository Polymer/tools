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

import {fs} from 'mz';
import * as path from 'path';
import {Analysis, Analyzer, FSUrlLoader, InMemoryOverlayUrlLoader, PackageUrlResolver} from 'polymer-analyzer';
import {WorkspaceRepo} from 'polymer-workspaces';

import {PartialConversionSettings} from './conversion-settings';
import {dependencyMap, generatePackageJson, readJson, writeJson} from './manifest-converter';
import {polymerFileOverrides} from './special-casing';
import {mkdirp, writeFileResults} from './util';
import {WorkspaceConverter} from './workspace-converter';


/**
 * Configuration options required for workspace conversions. Contains
 * information about which repos to convert and what new version to set
 * each npm package at.
 */
interface WorkspaceConversionSettings extends PartialConversionSettings {
  packageVersion: string;
  workspaceDir: string;
  reposToConvert: WorkspaceRepo[];
}


/**
 * Create a symlink from the repo into the workspace's node_modules directory.
 */
async function writeNpmSymlink(
    options: WorkspaceConversionSettings, repo: WorkspaceRepo) {
  const packageJsonPath = path.join(repo.dir, 'package.json');
  if (!await fs.exists(packageJsonPath)) {
    return;
  }
  const packageJson = readJson(packageJsonPath);
  let packageName = packageJson['name'] as string;
  let parentName = path.join(options.workspaceDir, 'node_modules');
  if (packageName.startsWith('@')) {
    const slashIndex = packageName.indexOf('/');
    const scopeName = packageName.substring(0, slashIndex);
    parentName = path.join(parentName, scopeName);
    packageName = packageName.substring(slashIndex + 1);
  }
  await mkdirp(parentName);
  const linkName = path.join(parentName, packageName);
  await fs.symlink(repo.dir, path.resolve(linkName));
}

/**
 * For a given repo, generate a new package.json and write it to disk.
 */
async function writePackageJson(repo: WorkspaceRepo, packageVersion: string) {
  const bowerJsonPath = path.join(repo.dir, 'bower.json');
  const bowerJson = readJson(bowerJsonPath);
  const bowerName = bowerJson.name;
  let depMapping: {npm: string}|undefined = dependencyMap[bowerName];
  if (!depMapping) {
    console.warn(`"${bowerName}" npm mapping not found`);
    depMapping = {npm: bowerName};
  }
  const packageJson =
      generatePackageJson(bowerJson, depMapping.npm, packageVersion);
  writeJson(packageJson, repo.dir, 'package.json');
}

export function configureAnalyzer(options: WorkspaceConversionSettings) {
  const workspaceDir = options.workspaceDir;
  const urlLoader = new InMemoryOverlayUrlLoader(new FSUrlLoader(workspaceDir));
  for (const [url, contents] of polymerFileOverrides) {
    urlLoader.urlContentsMap.set(`polymer/${url}`, contents);
  }

  return new Analyzer({
    urlLoader,
    urlResolver: new PackageUrlResolver(),
  });
}

export function configureConverter(
    analysis: Analysis, options: WorkspaceConversionSettings) {
  return new WorkspaceConverter(analysis, options);
}

/**
 * Convert a set of workspace repos to JavaScript modules & npm.
 */
export default async function convert(options: WorkspaceConversionSettings) {
  const analyzer = configureAnalyzer(options);
  const analysis = await analyzer.analyzePackage();
  const converter = configureConverter(analysis, options);
  const results = await converter.convert();
  await writeFileResults(options.workspaceDir, results);

  // For each repo, generate a new package.json:
  for (const repo of options.reposToConvert) {
    try {
      writePackageJson(repo, options.packageVersion);
    } catch (err) {
      console.log('Error in bower.json -> package.json conversion:');
      console.error(err);
    }
  }

  // For each repo, generate a node_modules/ symlink in the workspace directory:
  for (const repo of options.reposToConvert) {
    try {
      await writeNpmSymlink(options, repo);
    } catch (err) {
      console.log(`Error in npm symlink creation:`);
      console.error(err);
    }
  }
}
