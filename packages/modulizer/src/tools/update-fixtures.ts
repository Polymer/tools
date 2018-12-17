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
import * as fs from 'fs-extra';
import * as commandLineArgs from 'command-line-args';
import {runFixture, TestConfig} from '../test/fixtures/run-fixture';

const cliDefs = [
  {
    name: 'skip-source-update',
    type: Boolean,
    defaultValue: false,
    description: `Whether to skip updating the source repo, ` +
        `so that the expected result is generated from the existing source.`,

  },
];

interface CliOpts {
  'skip-source-update': boolean;
}

interface UpdateFixtureOptions {
  folder: string;
  repoUrl: string;
  skipSourceUpdate: boolean;
  branch?: string;
}

async function updateFixture(options: UpdateFixtureOptions) {
  const fixturesDir =
      path.resolve(__dirname, '../../fixtures/packages/', options.folder);
  const sourceDir = path.join(fixturesDir, 'source');
  const convertedDir = path.join(fixturesDir, 'expected');

  if (!options.skipSourceUpdate) {
    const branch = options.branch || 'master';

    console.log(`Cloning ${options.repoUrl} #${branch} to ${sourceDir}...`);
    await fs.ensureDir(fixturesDir);
    await fs.remove(sourceDir);

    await exec(
        `git clone ${options.repoUrl} ${sourceDir} --branch=${
            branch} --depth=1`,
        {cwd: fixturesDir});
    await fs.remove(path.join(sourceDir, '.git'));
    await fs.remove(path.join(sourceDir, '.github'));
    await fs.remove(path.join(sourceDir, '.gitignore'));

    await overridePolymer(sourceDir);

    await exec('bower install', {cwd: sourceDir});
  }

  const testConfig = require(path.join(fixturesDir, 'test.js')) as TestConfig;
  await runFixture(sourceDir, convertedDir, testConfig);

  // Our integration tests always skip bower_components when comparing, so
  // there's no reason to check them into git.
  await fs.remove(path.join(convertedDir, 'bower_components'));

  console.log(`Done.`);
}

/**
 * Overrides the polymer dependency to Polymer/polymer#master and adds a
 * resolution to bower.json.
 */
async function overridePolymer(sourceDir: string) {
  const bowerJsonFilename = path.join(sourceDir, 'bower.json');
  const bowerJson = JSON.parse(await fs.readFile(bowerJsonFilename, 'utf-8'));

  if (bowerJson.name !== 'polymer') {
    bowerJson.dependencies = bowerJson.dependencies || {};
    bowerJson.dependencies.polymer = 'Polymer/polymer#master';

    bowerJson.resolutions = bowerJson.resolutions || {};
    bowerJson.resolutions.polymer = 'master';
    await fs.writeFile(
        bowerJsonFilename, JSON.stringify(bowerJson, null, 2), 'utf-8');
  }
}

(async () => {
  const options = commandLineArgs(cliDefs) as CliOpts;
  const skipSourceUpdate = options['skip-source-update'];

  let exitCode = 0;

  await Promise.all([
    updateFixture({
      folder: 'polymer',
      branch: '2.x',
      repoUrl: 'https://github.com/Polymer/polymer.git',
      skipSourceUpdate,
    }),
    updateFixture({
      folder: 'paper-button',
      branch: '2.x',
      repoUrl: 'https://github.com/PolymerElements/paper-button.git',
      skipSourceUpdate,
    }),
    updateFixture({
      folder: 'iron-icon',
      branch: '2.x',
      repoUrl: 'https://github.com/PolymerElements/iron-icon.git',
      skipSourceUpdate,
    }),
  ].map((p) => p.catch((e) => {
    // Exit with an error code if any fixture fails, but let them all finish.
    console.error(e);
    exitCode = 1;
  })));

  process.exit(exitCode);
})();
