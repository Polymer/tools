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

import * as fse from 'fs-extra';
import {EOL} from 'os';

const nodeModulesLine = 'node_modules';
const searchNodeModulesLine = new RegExp(`^/?${nodeModulesLine}`);

export async function ignoreNodeModules(ignoreFile: string) {
  let ignoreLines: string[] = [];
  if (await fse.pathExists(ignoreFile)) {
    const content = await fse.readFile(ignoreFile, 'utf-8');
    ignoreLines = content.split(EOL);
  }
  const hasNodeModules = ignoreLines.some((line) => {
    return searchNodeModulesLine.test(line);
  });
  if (hasNodeModules) {
    return;
  }
  ignoreLines.push(nodeModulesLine);
  const outContent = ignoreLines.join(EOL) + EOL;
  await fse.writeFile(ignoreFile, outContent);
}
