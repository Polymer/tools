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

import * as fs from 'mz/fs';
import * as path from 'path';
import {Analysis, Analyzer, FSUrlLoader, InMemoryOverlayUrlLoader, PackageUrlResolver} from 'polymer-analyzer';
import * as rimraf from 'rimraf';

import {AnalysisConverter, AnalysisConverterOptions} from './analysis-converter';
import {generatePackageJson, readJson, writeJson} from './manifest-converter';
import {polymerFileOverrides} from './special-casing';

const mkdirp = require('mkdirp');


type ConvertPackageOptions = AnalysisConverterOptions&{
  /**
   * The directory to read HTML files from.
   */
  readonly inDir?: string;

  /**
   * The directory to write converted JavaScript files to.
   */
  readonly outDir?: string;

  /**
   * The npm package name to use in package.json
   */
  readonly packageName: string;

  /**
   * The npm package version to use in package.json
   */
  readonly packageVersion: string;
  readonly prereleaseVersion?: string;
  /**
   * Flag: If true, clear the out directory before writing to it.
   */
  clearOutDir?: boolean;
};

export function configureAnalyzer(options: ConvertPackageOptions) {
  const inDir = options.inDir || process.cwd();

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
    excludes: options.excludes || [],
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
 * Converts an entire package from HTML imports to JS modules
 */
export async function convertPackage(options: ConvertPackageOptions) {
  const outDir = options.outDir || 'js_out';
  const outDirResolved = path.resolve(process.cwd(), outDir);
  console.log(`Out directory: ${outDirResolved}`);

  const npmPackageName = options.packageName;
  const npmPackageVersion = options.prereleaseVersion ?
      `${options.packageVersion}-${options.prereleaseVersion}` :
      options.packageVersion;

  const analyzer = configureAnalyzer(options);
  const analysis = await analyzer.analyzePackage();
  const converter = configureConverter(analysis, options);
  const results = await converter.convert();
  if (options.clearOutDir) {
    rimraf.sync(outDirResolved);
  }

  try {
    await fs.mkdir(outDirResolved);
  } catch (e) {
    if (e.errno === -17) {  // directory exists
      // do nothing
    } else {
      throw e;
    }
  }

  for (const [newPath, newSource] of results) {
    const outPath = path.resolve(outDirResolved, newPath);
    mkdirp.sync(path.dirname(outPath));
    if (newSource !== undefined) {
      await fs.writeFile(outPath, newSource);
    } else {
      await fs.unlink(outPath);
    }
  }

  try {
    const bowerJson = readJson(path.join(options.inDir || '.', 'bower.json'));
    const packageJson =
        generatePackageJson(bowerJson, npmPackageName, npmPackageVersion);
    writeJson(packageJson, outDir, 'package.json');
  } catch (e) {
    console.log('error in bower.json -> package.json conversion');
    console.error(e);
  }
}
