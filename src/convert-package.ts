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

  /**
   * Flag: If true, clear the out directory before writing to it.
   */
  clearOutDir?: boolean;
};

export function configureAnalyzer(options: ConvertPackageOptions) {
  const inDir = options.inDir || process.cwd();

  // TODO(fks) 07-06-2015: Convert this to a configurable option
  // 'lib/utils/boot.html' - This is a special file that overwrites exports
  // and does other things that make less sense in an ESM world.
  const bootOverrideHtml = `<script>
  window.JSCompiler_renameProperty = function(prop, obj) { return prop; }
</script>`;
  const urlLoader = new InMemoryOverlayUrlLoader(new FSUrlLoader(inDir));
  urlLoader.urlContentsMap.set('lib/utils/boot.html', bootOverrideHtml);
  urlLoader.urlContentsMap.set(
      'bower_components/polymer/lib/utils/boot.html', bootOverrideHtml);

  return new Analyzer({
    urlLoader,
    urlResolver: new PackageUrlResolver(),
  });
}

export function configureConverter(
    analysis: Analysis, options: ConvertPackageOptions) {
  return new AnalysisConverter(analysis, {
    rootNamespaces: options.rootNamespaces || ['Polymer'],
    excludes: options.excludes ||
        [
          'lib/elements/dom-module.html',
        ],
    referenceExcludes: options.referenceExcludes ||
        [
          'Polymer.DomModule',
          'Polymer.Settings',
          'Polymer.log',
          'Polymer.rootPath',
          'Polymer.sanitizeDOMValue'
        ],
    mutableExports: options.mutableExports || {
      'Polymer.telemetry': ['instanceCount'],
    },
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
  const npmPackageVersion = options.packageVersion;

  // TODO(justinfagnani): These setting are only good for Polymer core
  // and should be extracted into a config file.
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

  for (const [jsUrl, newSource] of results!) {
    const outPath = path.resolve(outDirResolved, jsUrl);
    mkdirp.sync(path.dirname(outPath));
    await fs.writeFile(outPath, newSource);
  }

  try {
    const bowerJson = readJson('bower.json');
    const packageJson =
        generatePackageJson(bowerJson, npmPackageName, npmPackageVersion);
    writeJson(packageJson, outDir, 'package.json');
  } catch (e) {
    console.log('error in bower.json -> package.json conversion');
    console.error(e);
  }
}
