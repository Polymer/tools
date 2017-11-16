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
import {Analyzer, FSUrlLoader, InMemoryOverlayUrlLoader, PackageUrlResolver} from 'polymer-analyzer';
import {WorkspaceRepo} from 'polymer-workspaces';

import {createDefaultConversionSettings, PartialConversionSettings} from './conversion-settings';
import {generatePackageJson, readJson, writeJson} from './manifest-converter';
import {ProjectConverter} from './project-converter';
import {polymerFileOverrides} from './special-casing';
import {lookupNpmPackageName, WorkspaceUrlHandler} from './urls/workspace-url-handler';

import {mkdirp, writeFileResults} from './util';


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
function writePackageJson(repo: WorkspaceRepo, packageVersion: string) {
  const bowerPackageName = path.basename(repo.dir);
  const bowerJsonPath = path.join(repo.dir, 'bower.json');
  const bowerJson = readJson(bowerJsonPath);
  const npmPackageName =
      lookupNpmPackageName(bowerJsonPath) || bowerPackageName;
  const packageJson =
      generatePackageJson(bowerJson, npmPackageName, packageVersion);
  writeJson(packageJson, repo.dir, 'package.json');
}

/**
 * Configure a basic analyzer instance for the workspace.
 */
function configureAnalyzer(options: WorkspaceConversionSettings) {
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

/**
 * Convert a set of workspace repos to JavaScript modules & npm.
 */
export default async function convert(options: WorkspaceConversionSettings) {
  const analyzer = configureAnalyzer(options);
  const analysis = await analyzer.analyzePackage();
  const htmlDocuments = [...analysis.getFeatures({kind: 'html-document'})];
  const conversionSettings = createDefaultConversionSettings(analysis, options);
  const urlHandler = new WorkspaceUrlHandler(options.workspaceDir);
  const converter = new ProjectConverter(urlHandler, conversionSettings);

  // For each repo, convert the relevant HTML documents:
  for (const repo of options.reposToConvert) {
    const repoDirName = repo.dir.split('/').pop()!;
    const repoDocuments = htmlDocuments.filter((d) => {
      return d.url.startsWith(repoDirName) &&
          !conversionSettings.excludes.has(d.url);
    });
    for (const document of repoDocuments) {
      converter.convertDocument(document);
    }
  }

  // Process & write each conversion result:
  await writeFileResults(options.workspaceDir, converter.getResults());

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
