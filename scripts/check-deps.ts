/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at
 * http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at
 * http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at
 * http://polymer.github.io/PATENTS.txt
 *
 * This program analyzes the dependencies of all packages in the monorepo, and
 * reports any incompatible semver ranges.
 *
 * Conflicts reported here do not indicate an error. Keeping our dependency
 * ranges compatible when possible simply helps to optimize the combined install
 * footprint of our tools.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as semver from 'semver';

const packagesDir = path.join(__dirname, '..', 'packages');

const ansi = {
  reset: '\x1b[0m',
  yellow: '\x1b[33m',
}

interface PackageJson {
  dependencies?: {[name: string]: string};
  devDependencies?: {[name: string]: string};
}

function main() {
  const deps = new Map<string, Map<string, string>>();
  let maxPackageNameLength = 0;

  for (const packageName of fs.readdirSync(packagesDir)) {
    let packageJsonStr;
    try {
      packageJsonStr = fs.readFileSync(
          path.join(packagesDir, packageName, 'package.json'), 'utf-8');
    } catch (err) {
      if (err.code === 'ENOTDIR' || err.code === 'ENOENT') {
        continue;
      }
      throw err;
    }
    const packageJson = JSON.parse(packageJsonStr) as PackageJson;

    for (const [dep, semver] of
             [...Object.entries(packageJson.dependencies || {}),
              ...Object.entries(packageJson.devDependencies || {})]) {
      let semvers = deps.get(dep);
      if (semvers === undefined) {
        semvers = new Map();
        deps.set(dep, semvers);
      }
      semvers.set(packageName, semver);
    }

    maxPackageNameLength = Math.max(maxPackageNameLength, packageName.length);
  }

  for (const dep of [...deps.keys()].sort()) {
    const semvers = deps.get(dep) !;
    const conflicts = new Set<string>();
    const entries = [...semvers.entries()];
    for (let a = 0; a < entries.length; a++) {
      for (let b = a + 1; b < entries.length; b++) {
        const [aName, aSemver] = entries[a];
        const [bName, bSemver] = entries[b];
        if (!semver.intersects(aSemver, bSemver)) {
          conflicts.add(aName);
          conflicts.add(bName);
        }
      }
    }

    if (conflicts.size > 0) {
      console.log(`\n${ansi.yellow}${dep}${ansi.reset}`);
      console.log('-'.repeat(dep.length));

      for (const packageName of [...conflicts].sort()) {
        const spaces =
            ' '.repeat(maxPackageNameLength - packageName.length + 1);
        console.log(`${packageName}${spaces}${semvers.get(packageName)}`);
      }
    }
  }
}

main();
