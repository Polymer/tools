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

// Install source map support for stack traces, etc.
require('source-map-support').install();

import * as path from 'path';
import {exec} from 'mz/child_process';
import {convertPackage} from '../convert-package';
// import rimraf = require('rimraf');

// const repoUrl = 'https://github.com/Polymer/polymer.git';
const fixturesDirPath =
    path.resolve(__dirname, '../../fixtures/generated/polymer');
const sourceDir = path.join(fixturesDirPath, 'source');
const convertedDir = path.join(fixturesDirPath, 'expected');

(async () => {

  await exec(`mkdir -p ${fixturesDirPath}`);
  // console.log(`Cloning ${repoUrl} to ${sourceDir}...`);
  // rimraf.sync(sourceDir);
  // await exec(
  //     'git clone https://github.com/Polymer/polymer.git source --depth=1',
  //     {cwd: fixturesDirPath});

  console.log(`Converting...`);
  await convertPackage({
    inDir: sourceDir,
    outDir: convertedDir,
    clearOutDir: true,
    packageName: '@polymer/polymer',
    packageVersion: '3.0.0',
  });
  console.log(`Done.`);

})();
