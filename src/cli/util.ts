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
 */


/**
 * Parse a raw CLI input string for a dependency mapping. See
 * `--dependency-mapping` CLI option document more information on input format.
 */
export function parseDependencyMappingInput(rawMapping: string):
    [string, string, string] {
  const parsedMapping = rawMapping.split(',');
  if (parsedMapping.length !== 3) {
    throw new Error(
        `--dependency-mapping: Expected format "bower,npm,semver". Actual input "${
            rawMapping}"`);
  }
  return parsedMapping as [string, string, string];
}
