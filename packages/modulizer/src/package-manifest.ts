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

import * as fse from 'fs-extra';
import {EOL} from 'os';
import * as path from 'path';
import * as spdxLicenseList from 'spdx-license-list/simple';

import {replaceHtmlExtensionIfFound} from './urls/util';
import {BowerConfig} from './bower-config';
import {YarnConfig} from './npm-config';

interface DependencyMapEntry {
  npm: string;
  semver: string;
}
interface DependencyMap {
  [bower: string]: DependencyMapEntry|undefined;
}

/** The default dependency map from bower->npm. */
const defualtDependencyMap: DependencyMap =
    fse.readJSONSync(path.join(__dirname, '..', 'dependency-map.json'));
/** A custom dependency map that the user can add to. */
const customDependencyMap: DependencyMap = {};
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
 * Save a custom bower->npm dependency mapping for lookup.
 */
export function saveDependencyMapping(
    bowerPackageName: string, npm: string, semver: string) {
  customDependencyMap[bowerPackageName] = {npm, semver};
}


/**
 * Lookup the corresponding npm package name in our local map. By default, this
 * method will log a standard warning message to the user if no mapping was
 * found.
 */
export function lookupDependencyMapping(bowerPackageName: string) {
  const result = customDependencyMap[bowerPackageName] ||
      defualtDependencyMap[bowerPackageName];
  if (!result && !warningCache.has(bowerPackageName)) {
    warningCache.add(bowerPackageName);
    console.warn(
        `WARN: bower->npm mapping for "${bowerPackageName}" not found`);
  }
  return result;
}

function setNpmDependencyFromBower(
    obj: {[pkg: string]: string},
    bowerPackageName: string,
    useLocal?: Map<string, string>) {
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
 * helper function to serialize and parse JSON.
 */
export function writeJson(json: object, ...pathPieces: string[]) {
  const jsonPath = path.resolve(...pathPieces);
  const jsonContents =
      JSON.stringify(json, undefined, 2).split('\n').join(EOL) + EOL;
  fse.writeFileSync(jsonPath, jsonContents);
}

/**
 * Generate the package.json for a modulized package from its bower.json,
 * optionally merging with an existing package.json.
 *
 * @param bowerJson The package's existing parsed bower.json.
 * @param options Values from here always win over existingPackageJson.
 * @param useLocal Optional map of any NPM dependencies (name -> local file
 * path) that should be referenced via local file path and not public package
 * name in the package.json. This is useful for testing against other, converted
 * repos.
 * @param existingPackageJson Optional pre-existing parsed package.json. If
 * provided, values from this package.json will not be modified, with these
 * exceptions:
 *   - name, version, flat, and private are always overridden.
 *   - dependencies, devDependencies, and resolutions are merged, with newly
 *     generated versions for the same package winning.
 */
export function generatePackageJson(
    bowerJson: Partial<BowerConfig>,
    options: {name: string, version: string, flat: boolean, private: boolean},
    useLocal?: Map<string, string>,
    existingPackageJson?: Partial<YarnConfig>): YarnConfig {
  if (existingPackageJson && existingPackageJson.name &&
      existingPackageJson.name !== options.name) {
    console.warn(
        `${bowerJson.name}: package.json name is changing from ` +
        `"${existingPackageJson.name}" to "${options.name}".`);
  }

  const packageJson: YarnConfig = {
    description: bowerJson.description,
    keywords: bowerJson.keywords,
    repository: bowerJson.repository,
    homepage: bowerJson.homepage,

    ...existingPackageJson,
    ...options,
  };

  // Don't need to explicitly write these default cases.
  if (packageJson.flat === false) {
    delete packageJson.flat;
  }
  if (packageJson.private === false) {
    delete packageJson.private;
  }

  // TODO (fks): Remove these resolutions needed by wct-browser-legacy
  // https://github.com/Polymer/polymer-modulizer/issues/251
  packageJson.resolutions = {
    ...packageJson.resolutions,
    'inherits': '2.0.3',
    'samsam': '1.1.3',
    'supports-color': '3.1.2',
    'type-detect': '1.0.0'
  };

  if (!packageJson.main) {
    let bowerMains = new Array<string>();
    if (typeof bowerJson.main === 'string') {
      bowerMains = [bowerJson.main];
    } else if (Array.isArray(bowerJson.main)) {
      bowerMains = bowerJson.main;
    }
    // Bower configs allow one file per filetype. There might be an HTML file
    // for the main element, and some extra things like a CSS file.
    const htmlMains =
        bowerMains.filter((filepath) => filepath.endsWith('.html'));

    if (htmlMains.length === 1) {
      // Assume that this bower main is already a correct relative path and that
      // the module equivalent will be in the same directory but with a JS
      // extension.
      //
      // TODO(aomarks) Use the conversion result to look up the new path in case
      // this file mapping becomes more complicated.
      packageJson.main = replaceHtmlExtensionIfFound(htmlMains[0]);

    } else if (htmlMains.length > 1) {
      // There can be multiple HTML files in main, e.g. a repo like
      // paper-behaviors which contains 3 separate Polymer behaviors. We
      // currently let that be, so importing the module directly will fail. We
      // could also generate an index that re-exports all of the symbols from
      // all of the mains.
      console.warn(
          `${bowerJson.name}: Found multiple HTML mains in bower.json. ` +
          `A main was not added to package.json, ` +
          `so this package will not be directly importable by name. ` +
          `Manually update main in your bower.json or package.json to fix.`);

    } else {
      console.warn(
          `${bowerJson.name}: Did not find an HTML main in bower.json. ` +
          `A main was not added to package.json, ` +
          `so this package will not be directly importable by name. ` +
          `Manually update main in your bower.json or package.json to fix.`);
    }
  } else {
    // Certain polymer repos have an existing package.json with its main set to
    // an HTML file.
    packageJson.main = replaceHtmlExtensionIfFound(packageJson.main);
  }

  if (!packageJson.author &&
      (!packageJson.contributors || packageJson.contributors.length === 0)) {
    const npmAuthors = [];
    // Some Polymer elements use `author` even though the bower.json spec only
    // specifies `authors`. Check both.
    const bowerAuthors = bowerJson.authors || bowerJson.author || [];
    for (const bowerAuthor of bowerAuthors) {
      if (typeof bowerAuthor === 'string') {
        npmAuthors.push(bowerAuthor);
      } else {
        npmAuthors.push({
          name: bowerAuthor.name,
          email: bowerAuthor.email,
          url: bowerAuthor.homepage,  // The only difference in the specs.
        });
      }
    }
    if (npmAuthors.length === 1) {
      packageJson.author = npmAuthors[0];
    } else if (npmAuthors.length > 1) {
      packageJson.contributors = npmAuthors;
    }
  }

  if (!packageJson.license) {
    let bowerLicenses = new Array<string>();
    if (typeof bowerJson.license === 'string') {
      bowerLicenses = [bowerJson.license];
    } else if (Array.isArray(bowerJson.license)) {
      bowerLicenses = bowerJson.license;
    }

    if (bowerLicenses.length === 1) {
      packageJson.license = bowerLicenses[0];
      if (packageJson.license.includes('polymer.github.io/LICENSE')) {
        packageJson.license = 'BSD-3-Clause';
      } else if (!spdxLicenseList.has(bowerLicenses[0])) {
        console.warn(
            `${bowerJson.name}: ` +
            `'${bowerJson.license}' is not a valid SPDX license. ` +
            `You can find a list of valid licenses at ` +
            `https://spdx.org/licenses/`);
      }

    } else if (bowerLicenses.length > 1) {
      console.warn(
          `${bowerJson.name}: Found multiple licenses in bower.json, ` +
          `but package.json must have only one.`);

    } else {
      console.warn(
          `${bowerJson.name}: ` +
          `Could not automatically find appropriate license. ` +
          `Please manually set your package.json license according to ` +
          `https://docs.npmjs.com/files/package.json#license`);
    }
  }

  packageJson.dependencies = {...packageJson.dependencies};
  for (const bowerPackageName in bowerJson.dependencies || []) {
    setNpmDependencyFromBower(
        packageJson.dependencies, bowerPackageName, useLocal);
  }
  packageJson.devDependencies = {...packageJson.devDependencies};
  for (const bowerPackageName in bowerJson.devDependencies || []) {
    setNpmDependencyFromBower(
        packageJson.devDependencies, bowerPackageName, useLocal);
  }

  return packageJson;
}
