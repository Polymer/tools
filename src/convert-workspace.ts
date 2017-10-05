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

import {BaseConverterOptions} from './base-converter';
import {dependencyMap, generatePackageJson, readJson, writeJson} from './manifest-converter';
import {polymerFileOverrides} from './special-casing';
import {WorkspaceConverter} from './workspace-converter';

interface ConvertWorkspaceOptions extends BaseConverterOptions {
  packageVersion: string;
  inDir: string;
}

export function configureAnalyzer(options: ConvertWorkspaceOptions) {
  const inDir = options.inDir || process.cwd();

  const urlLoader = new InMemoryOverlayUrlLoader(new FSUrlLoader(inDir));
  for (const [url, contents] of polymerFileOverrides) {
    urlLoader.urlContentsMap.set(`polymer/${url}`, contents);
  }

  return new Analyzer({
    urlLoader,
    urlResolver: new PackageUrlResolver(),
  });
}

export function configureConverter(
    analysis: Analysis, options: ConvertWorkspaceOptions) {
  return new WorkspaceConverter(analysis, {
    namespaces: options.namespaces,
    excludes:
        [...(options.excludes || []), 'neon-animation/web-animations.html'],
    referenceExcludes: options.referenceExcludes ||
        [
          'Polymer.DomModule',
          'Polymer.Settings',
          'Polymer.log',
          'Polymer.rootPath',
          'Polymer.sanitizeDOMValue',
          'Polymer.Collection',
        ],
  });
}

export async function convertWorkspace(options: ConvertWorkspaceOptions) {
  const analyzer = configureAnalyzer(options);
  const analysis = await analyzer.analyzePackage();
  const converter = configureConverter(analysis, options);
  const results = await converter.convert();

  for (const [outUrl, newSource] of results) {
    const outPath = path.join(options.inDir, outUrl);
    if (newSource === undefined) {
      await fs.unlink(outPath);
    } else {
      await fs.writeFile(outPath, newSource);
    }
  }

  for (const repo of await fs.readdir(options.inDir)) {
    const bowerPath = path.join(options.inDir, repo, 'bower.json');
    const bowerExists = await fs.exists(bowerPath);
    if (!bowerExists) {
      continue;
    }
    try {
      const bowerJson = readJson(bowerPath);
      // TODO(https://github.com/Polymer/polymer-modulizer/issues/122):
      // unhardcode
      const bowerName = bowerJson.name;

      let depMapping: {npm: string}|undefined = dependencyMap[bowerName];
      if (!depMapping) {
        console.warn(`"${bowerName}" npm mapping not found`);
        depMapping = {npm: bowerName};
      }

      const packageJson =
          generatePackageJson(bowerJson, depMapping.npm, options.packageVersion);
      writeJson(packageJson, options.inDir, repo, 'package.json');
    } catch (e) {
      console.log('error in bower.json -> package.json conversion');
      console.error(e);
    }
  }
}
