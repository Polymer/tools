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
import * as rimraf from 'rimraf';
import util = require('util');
import _mkdirp = require('mkdirp');
const mkdirp = util.promisify(_mkdirp);

import convertPackage from '../convert-package';

interface UpdateFixtureOptions {
  folder: string;
  repoUrl: string;
  packageName: string;
  packageVersion: string;
}
async function updateFixture(options: UpdateFixtureOptions) {
  const fixturesDir =
      path.resolve(__dirname, '../../fixtures/packages/', options.folder);
  const sourceDir = path.join(fixturesDir, 'source');
  const convertedDir = path.join(fixturesDir, 'expected');

  console.log(`Cloning ${options.repoUrl} to ${sourceDir}...`);
  await mkdirp(fixturesDir);
  rimraf.sync(sourceDir);

  await exec(
      `git clone ${options.repoUrl} ${sourceDir} --depth=1`,
      {cwd: fixturesDir});
  rimraf.sync(path.join(sourceDir, '.git'));
  rimraf.sync(path.join(sourceDir, '.github'));
  rimraf.sync(path.join(sourceDir, '.gitignore'));
  await exec('bower install', {cwd: sourceDir});

  console.log(`Converting...`);
  await convertPackage({
    inDir: sourceDir,
    outDir: convertedDir,
    cleanOutDir: true,
    packageName: options.packageName,
    packageVersion: options.packageVersion,
  });
  console.log(`Done.`);
}

(async () => {
  await Promise.all([
    updateFixture({
      folder: 'polymer',
      repoUrl: 'https://github.com/Polymer/polymer.git',
      packageName: '@polymer/polymer',
      packageVersion: '3.0.0',
    }),
    updateFixture({
      folder: 'paper-button',
      repoUrl: 'https://github.com/PolymerElements/paper-button.git',
      packageName: '@polymer/paper-button',
      packageVersion: '3.0.0',
    }),
    updateFixture({
      folder: 'iron-icon',
      repoUrl: 'https://github.com/PolymerElements/iron-icon.git',
      packageName: '@polymer/iron-icon',
      packageVersion: '3.0.0',
    }),
  ]);
})();
