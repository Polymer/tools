/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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
 * This module consists of functions for transformations to filesystem and url
 * paths.
 * TODO(usergenic): We should consider migrating the responsibility of
 * path-related string transformation to a package like `upath`.
 * Please see: https://www.npmjs.com/package/upath
 */

import * as path from 'path';

const posixSepRE = /\//g;
const winSepRE = /\\/g;

/**
 * Returns a properly encoded URL representing the relative URL from the root
 * to the target.  This function will throw an error if the target is outside
 * the root.  We use this to map a file from the filesystem to the relative
 * URL that represents it in the build.
 */
export function urlFromPath(root: string, target: string): string {
  target = posixifyPath(target);
  root = posixifyPath(root);

  const relativePath = path.posix.relative(root, target);

  // The startsWith(root) check is important on Windows because of the case
  // where paths have different drive letters.  The startsWith('../') will
  // catch the general not-in-root case.
  if (!target.startsWith(root) || relativePath.startsWith('../')) {
    throw new Error(`target path is not in root: ${target} (${root})`);
  }

  return encodeURI(relativePath);
}

/**
 * Returns a filesystem path for the url, relative to the root.
 */
export function pathFromUrl(root: string, url: string) {
  return platformifyPath(decodeURI(
    path.posix.join(posixifyPath(root), path.posix.join('/', url))));
}

/**
 * Converts forward slashes to backslashes, when on Windows.  Noop otherwise.
 */
export function platformifyPath(filepath: string): string {
  return filepath.replace(posixSepRE, path.sep);
}

/**
 * Returns a string where all Windows path separators are converted to forward
 * slashes.
 * NOTE(usergenic): We will generate only canonical Windows paths, but this
 * function is exported so that we can create a forward-slashed Windows root
 * path when dealing with the `sw-precache` library, which uses `glob` npm
 * module generates only forward-slash paths in building its `precacheConfig`
 * map.
 */
export function posixifyPath(filepath: string): string {
  // We don't want to change backslashes to forward-slashes in the case where
  // we're already on posix environment, because they would be intentional in
  // that case (albeit weird.)
  if (path.sep === '\\') {
    filepath = filepath.replace(winSepRE, '/');
  }
  return filepath;
}
