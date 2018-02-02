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
import {EOL} from 'os';
import * as path from 'path';
import * as spdxLicenseList from 'spdx-license-list/simple';

interface DependencyMapEntry {
  npm: string;
  semver: string;
}
interface DependencyMap {
  [bower: string]: DependencyMapEntry|undefined;
}
const dependencyMap: DependencyMap =
    readJson(__dirname, '../dependency-map.json');
const warningCache: Set<String> = new Set();

/**
 * The name of the git branch for local git dependencies to point to. Without
 * a branch name, npm would just install from master.
 */
export const localDependenciesBranch = 'polymer-modulizer-testing';

/**
 * For a given dependency at path, return the value that will point to it in a
 * package.json "dependencies" or "devDependencies" object.
 */
function getLocalDependencyValue(path: string) {
  return `git+file:${path}#${localDependenciesBranch}`;
}

/**
 * Lookup the corresponding npm package name in our local map. By default, this
 * method will log a standard warning message to the user if no mapping was
 * found.
 */
export function lookupDependencyMapping(bowerPackageName: string) {
  const result = dependencyMap[bowerPackageName];
  if (!result && !warningCache.has(bowerPackageName)) {
    warningCache.add(bowerPackageName);
    console.warn(
        `WARN: bower->npm mapping for "${bowerPackageName}" not found`);
  }
  return result;
}

function setNpmDependencyFromBower(
    obj: any, bowerPackageName: string, useLocal?: Map<string, string>) {
  const depInfo = lookupDependencyMapping(bowerPackageName);
  if (!depInfo) {
    return;
  }
  if (useLocal && useLocal.has(depInfo.npm)) {
    obj[depInfo.npm] = getLocalDependencyValue(useLocal.get(depInfo.npm)!);
  } else {
    obj[depInfo.npm] = depInfo.semver;
  }
}

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
  const jsonContents =
      JSON.stringify(json, undefined, 2).split('\n').join(EOL) + EOL;
  fs.writeFileSync(jsonPath, jsonContents);
}

/**
 * Given a bower.json manifest, generate a package.json manifest for npm.
 *
 * Function takes an optional `useLocal` argument containing a map of any
 * npm dependencies (name -> local file path) that should be referenced via
 * local file path and not public package name in the package.json. This is
 * useful for testing against other, converted repos.
 */
export function generatePackageJson(
    bowerJson: any,
    npmName: string,
    npmVersion: string,
    useLocal?: Map<string, string>) {
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
    devDependencies: <any>{},
    // TODO (fks): Remove these resolutions needed by wct-browser-legacy
    // https://github.com/Polymer/polymer-modulizer/issues/251
    resolutions: {
      'inherits': '2.0.3',
      'samsam': '1.1.3',
      'supports-color': '3.1.2',
      'type-detect': '1.0.0',
    }
  };

  if (bowerJson.license.includes('polymer.github.io/LICENSE')) {
    packageJson.license = 'BSD-3-Clause';
  } else if (!spdxLicenseList.has(bowerJson.license)) {
    console.warn(
        `"${bowerJson.license}" is not a valid SPDX license. ` +
        `You can find a list of valid licenses at https://spdx.org/licenses/`);
  }

  for (const bowerPackageName in bowerJson.dependencies) {
    setNpmDependencyFromBower(
        packageJson.dependencies, bowerPackageName, useLocal);
  }
  for (const bowerPackageName in bowerJson.devDependencies) {
    setNpmDependencyFromBower(
        packageJson.devDependencies, bowerPackageName, useLocal);
  }

  return packageJson;
}
