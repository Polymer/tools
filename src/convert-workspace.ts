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
import * as semver from 'semver';

import {BaseConverterOptions} from './analysis-converter';
import {generatePackageJson, readJson, writeJson} from './manifest-converter';
import {WorkspaceConverter} from './workspace-converter';

interface ConvertWorkspaceOptions extends BaseConverterOptions {
  inDir: string;
  repos: string[];
}

export function configureAnalyzer(options: ConvertWorkspaceOptions) {
  const inDir = options.inDir || process.cwd();

  // TODO(fks) 07-06-2015: Convert this to a configurable option
  // 'polymer/lib/utils/boot.html' - This is a special file that overwrites
  // exports and does other things that make less sense in an ESM world.
  const bootOverrideHtml = `<script>
      window.JSCompiler_renameProperty = function(prop, obj) { return prop; }

      /** @namespace */
      let Polymer;
    </script>`;
  const urlLoader = new InMemoryOverlayUrlLoader(new FSUrlLoader(inDir));
  urlLoader.urlContentsMap.set('polymer/lib/utils/boot.html', bootOverrideHtml);

  return new Analyzer({
    urlLoader,
    urlResolver: new PackageUrlResolver(),
  });
}

export function configureConverter(
    analysis: Analysis, options: ConvertWorkspaceOptions) {
  return new WorkspaceConverter(analysis, {
    namespaces: options.namespaces,
    excludes: options.excludes,
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

export async function convertWorkspace(options: ConvertWorkspaceOptions) {
  console.log('Converting Workspace');
  const analyzer = configureAnalyzer(options);
  const analysis = await analyzer.analyzePackage();
  const converter = configureConverter(analysis, options);
  const results = await converter.convert();

  for (const [outUrl, newSource] of results) {
    // filter by repos we're converting
    await fs.writeFile(path.join(options.inDir, outUrl), newSource);
  }

  for (const repo of options.repos) {
    try {
      const bowerJson = readJson(path.join(options.inDir, repo, 'bower.json'));
      const npmPackageName = `@polymer/${repo}`;
      const npmPackageVersion =
          bowerJson.version ? semver.inc(bowerJson.version, 'major') : '3.0.0';
      const packageJson =
          generatePackageJson(bowerJson, npmPackageName, npmPackageVersion);
      writeJson(packageJson, options.inDir, repo, 'package.json');
    } catch (e) {
      console.log('error in bower.json -> package.json conversion');
      console.error(e);
    }
  }
}
