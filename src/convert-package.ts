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
import {Analyzer, FsUrlLoader, InMemoryOverlayUrlLoader, PackageUrlResolver, ResolvedUrl} from 'polymer-analyzer';

import {BowerConfig} from './bower-config';
import {createDefaultConversionSettings, PartialConversionSettings} from './conversion-settings';
import {ignoreNodeModules} from './gitignore';
import {YarnConfig} from './npm-config';
import {generatePackageJson, writeJson} from './package-manifest';
import {ProjectConverter} from './project-converter';
import {polymerFileOverrides} from './special-casing';
import {transformTravisConfig} from './travis-config';
import {PackageUrlHandler} from './urls/package-url-handler';
import {PackageType} from './urls/types';
import {deleteGlobsSafe, mkdirp, readJsonIfExists, rimraf, writeFileResults} from './util';

/**
 * Configuration options required for package-layout conversions. Contains
 * information about the package under conversion, including what files to
 * convert, its new package name, and its new npm version number.
 */
export interface PackageConversionSettings extends PartialConversionSettings {
  readonly packageName: string;
  readonly packageVersion: string;
  readonly packageType: PackageType;
  readonly inDir: string;
  readonly outDir: string;
  readonly cleanOutDir?: boolean;
}

/**
 * Create and/or clean the "out" directory, setting it up for conversion.
 */
async function setupOutDir(outDir: string, clean = false) {
  if (clean) {
    await rimraf(outDir);
  }
  try {
    await mkdirp(outDir);
  } catch (e) {
    if (e.errno === -17) {
      // directory exists, do nothing
    } else {
      throw e;
    }
  }
}

/**
 * Configure a basic analyzer instance for the package under conversion.
 */
function configureAnalyzer(options: PackageConversionSettings) {
  const urlResolver = new PackageUrlResolver();
  const urlLoader =
      new InMemoryOverlayUrlLoader(new FsUrlLoader(options.inDir));
  for (const [url, contents] of polymerFileOverrides) {
    urlLoader.urlContentsMap.set(urlResolver.resolve(url)!, contents);
    urlLoader.urlContentsMap.set(
        urlResolver.resolve(`../polymer/${url}` as ResolvedUrl)!, contents);
  }
  return new Analyzer({
    urlLoader,
    urlResolver,
  });
}

/**
 * Convert a package-layout project to JavaScript modules & npm.
 */
export default async function convert(options: PackageConversionSettings) {
  const outDir = options.outDir;
  const npmPackageName = options.packageName;
  await setupOutDir(outDir, options.cleanOutDir);

  // Configure the analyzer and run an analysis of the package.
  const bowerJson =
      await fse.readJSON(path.join(options.inDir, 'bower.json')) as
      Partial<BowerConfig>;
  const bowerPackageName = bowerJson.name!;
  const analyzer = configureAnalyzer(options);
  const analysis = await analyzer.analyzePackage();
  await setupOutDir(options.outDir, !!options.cleanOutDir);

  // Create the url handler & converter.
  const urlHandler = new PackageUrlHandler(
      analyzer,
      bowerPackageName,
      npmPackageName,
      options.packageType,
      options.inDir);
  const conversionSettings = createDefaultConversionSettings(analysis, options);
  const converter =
      new ProjectConverter(analysis, urlHandler, conversionSettings);

  // Convert the package
  await converter.convertPackage(bowerPackageName);

  // Filter out external results before writing them to disk.
  const results = converter.getResults();
  for (const [newPath] of results) {
    if (!PackageUrlHandler.isUrlInternalToPackage(newPath)) {
      results.delete(newPath);
    }
  }
  await writeFileResults(outDir, results);

  // transform travis config
  await transformTravisConfig(options.inDir, options.outDir);

  // add `node_modules` to gitignore
  const gitIgnoreFile = path.join(options.inDir, '.gitignore');
  await ignoreNodeModules(gitIgnoreFile);

  const packageJsonPath = path.join(options.inDir, 'package.json');
  const existingPackageJson =
      await readJsonIfExists<Partial<YarnConfig>>(packageJsonPath);

  // Generate a new package.json, and write it to disk.
  const packageJson = generatePackageJson(
      bowerJson,
      {
        name: options.packageName,
        version: options.packageVersion,
        flat: options.flat,
        private: options.private,
      },
      undefined,
      existingPackageJson);
  writeJson(packageJson, packageJsonPath);

  // Delete files that were explicitly requested to be deleted.
  if (options.deleteFiles !== undefined) {
    await deleteGlobsSafe(options.deleteFiles, outDir);
  }

  // TODO(fks): create a new manifest.json, and write it to disk.
  // Currently blocked by the fact that package-url-handler treats all
  // dependencies as local/internal.
}
