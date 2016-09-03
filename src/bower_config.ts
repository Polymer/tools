/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as path from 'path';
import * as fs from 'fs';

function bowerConfigPath(root?: string): string {
  root = root || process.cwd();
  try {
    return path.resolve(root, 'bower.json');
  } catch (e) {
    return null;
  }
}

function bowerConfigContents(root?: string): string {
  let contents: string;

  try {
    contents = fs.readFileSync(bowerConfigPath(root)).toString();
  } catch (e) {
    return '{}'
  }

  return contents || '{}';
}

export function bowerConfig(root?: string) {
  try {
    let config = bowerConfigContents(root);
    if (config) {
      return JSON.parse(config);
    }
  } catch (e) {
    console.error('Could not parse bower.json');
    console.error(e);
  }

  return {};
}
