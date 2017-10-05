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

import * as fs from 'fs';
import * as path from 'path';

import {existsSync} from './fs';

/**
 * @returns a dictionary object of dev dependencies from the bower.json
 * entries in all workspace repos that are marked for test, suitable for
 * serializing into the devDependencies key of a generated bower.json file
 * for the workspace dir.
 *
 * TODO(usergenic): Merge strategy blindly overwrites previous value for key
 * with whatever new value it encounters as we iterate through bower configs
 * which may not be what we want.  Preserving the
 * highest semver value is *probably* the desired approach
 * instead.
 */
export function mergedBowerConfigsFromRepos(repos: {dir: string}[]): {
  name: string; dependencies: {[key: string]: string};
  resolutions: {[key: string]: string};
} {
  const merged: {
    name: string; dependencies: {[key: string]: string};
    resolutions: {[key: string]: string};
  } = {
    name: 'generated-bower-config-for-workspace',
    dependencies: {},
    resolutions: {},
  };
  for (const repo of repos) {
    // TODO(usergenic): Verify that we can assume bower.json is the config
    // file in the event any repo-specific .bowerrc files are capable of
    // redefining its name.
    const bowerJsonPath = path.join(repo.dir, 'bower.json');
    if (!existsSync(bowerJsonPath)) {
      continue;
    }
    const bowerJson = fs.readFileSync(bowerJsonPath).toString();
    const bowerConfig = JSON.parse(bowerJson);
    if (bowerConfig.devDependencies) {
      for (const name in bowerConfig.devDependencies) {
        merged.dependencies[name] = bowerConfig.devDependencies[name];
      }
    }
    if (bowerConfig.dependencies) {
      for (const name in bowerConfig.dependencies) {
        merged.dependencies[name] = bowerConfig.dependencies[name];
      }
    }
    if (bowerConfig.resolutions) {
      for (const name in bowerConfig.resolutions) {
        merged.resolutions[name] = bowerConfig.resolutions[name];
      }
    }
    if (bowerConfig.version) {
      merged.resolutions[repo.dir] = bowerConfig.version;
    }
  }
  return merged;
}
