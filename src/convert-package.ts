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

import {Analysis, Analyzer, FSUrlLoader, InMemoryOverlayUrlLoader, PackageUrlResolver} from 'polymer-analyzer';

import {AnalysisConverter, AnalysisConverterOptions} from './analysis-converter';
import {generatePackageJson, readJson, writeJson} from './manifest-converter';
import {polymerFileOverrides} from './special-casing';
import {mkdirp, rimraf, writeFileResults} from './util';



type ConvertPackageOptions = AnalysisConverterOptions&{
  /**
   * The directory to read HTML files from.
   */
  readonly inDir: string;

  /**
   * The directory to write converted JavaScript files to.
   */
  readonly outDir: string;

  /**
   * The npm package name to use in package.json
   */
  readonly packageName: string;

  /**
   * The npm package version to use in package.json
   */
  readonly packageVersion: string;
  /**
   * Flag: If true, clear the out directory before writing to it.
   */
  cleanOutDir?: boolean;
};


/**
 * Create and/or clean the "out" directory, setting it up for conversion.
 */
async function setupOutDir(outDir: string, clean: boolean) {
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

export function configureAnalyzer(options: ConvertPackageOptions) {
  const inDir = options.inDir;

  const urlLoader = new InMemoryOverlayUrlLoader(new FSUrlLoader(inDir));
  for (const [url, contents] of polymerFileOverrides) {
    urlLoader.urlContentsMap.set(url, contents);
    urlLoader.urlContentsMap.set(`bower_components/polymer/${url}`, contents);
  }

  return new Analyzer({
    urlLoader,
    urlResolver: new PackageUrlResolver(),
  });
}

export function configureConverter(
    analysis: Analysis, options: ConvertPackageOptions) {
  return new AnalysisConverter(analysis, {
    packageName: options.packageName,
    packageType: 'element',
    namespaces: options.namespaces,
    excludes:
        [...(options.excludes || []), 'neon-animation/web-animations.html'],
    referenceExcludes: options.referenceExcludes ||
        [
          'Polymer.Settings',
          'Polymer.log',
          'Polymer.rootPath',
          'Polymer.sanitizeDOMValue',
          'Polymer.Collection',
        ],
    mainFiles: options.mainFiles
  });
}

/**
 * Convert a package-layout project to JavaScript modules & npm.
 */
export default async function convert(options: ConvertPackageOptions) {
  const outDir = options.outDir;
  const npmPackageName = options.packageName;
  const npmPackageVersion = options.packageVersion;
  console.log(`Out directory: ${outDir}`);

  const bowerJson = readJson(options.inDir, 'bower.json');
  const analyzer = configureAnalyzer(options);
  const analysis = await analyzer.analyzePackage();
  const converter = configureConverter(analysis, options);
  const results = await converter.convert();
  await setupOutDir(options.outDir, !!options.cleanOutDir);
  await writeFileResults(outDir, results);

  // Generate a new package.json, and write it to disk.
  try {
    const packageJson =
        generatePackageJson(bowerJson, npmPackageName, npmPackageVersion);
    writeJson(packageJson, outDir, 'package.json');
  } catch (err) {
    console.log(
        `error in bower.json -> package.json conversion (${err.message})`);
  }
}
