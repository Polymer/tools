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

'use strict';

import * as fs from 'mz/fs';
import * as path from 'path';

interface DependencyMapEntry {
  npm: string;
  semver: string;
}
interface DependencyMap {
  [bower: string]: DependencyMapEntry|undefined;
}

export const dependencyMap: DependencyMap =
    readJson(__dirname, '../dependency-map.json');

/**
 * helper function to read and parse JSON.
 */
export function readJson(...pathPieces: string[]) {
  const jsonPath = path.resolve(...pathPieces);
  const jsonContents = fs.readFileSync(jsonPath, 'utf-8');
  return JSON.parse(jsonContents);
}

/**
 * helper function to serialize and parse JSON.
 */
export function writeJson(json: any, ...pathPieces: string[]) {
  const jsonPath = path.resolve(...pathPieces);
  const jsonContents = JSON.stringify(json, undefined, 2);
  fs.writeFileSync(jsonPath, jsonContents);
}

/**
 * Given a bower.json manifest, generate a package.json manifest for npm.
 */
export function generatePackageJson(
    bowerJson: any, npmName: string, npmVersion: string) {
  const packageJson = {
    name: npmName,
    flat: true,
    version: npmVersion,
    description: bowerJson.description,
    author: bowerJson.author,
    contributors: bowerJson.contributors || bowerJson.authors,
    keywords: bowerJson.keywords,
    main: (typeof bowerJson.main === 'string') ? bowerJson.main : undefined,
    repository: bowerJson.repository,
    license: bowerJson.license,
    homepage: bowerJson.homepage,
    dependencies: <any>{},
    devDependencies: {}
  };

  for (const bowerDep in bowerJson.dependencies) {
    const depMapping = dependencyMap[bowerDep];
    if (!depMapping) {
      console.warn(`"${bowerDep}" npm mapping not found`);
      continue;
    }
    packageJson.dependencies[depMapping.npm] = depMapping.semver;
  }

  // TODO(fks) 07-18-2017: handle devDependencies. Right now wct creates a too
  // complicated flat dependency install.

  return packageJson;
}
