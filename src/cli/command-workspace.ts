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

import * as chalk from 'chalk';
import * as fs from 'fs';
import * as path from 'path';
import {Workspace} from 'polymer-workspaces';

import {CliOptions} from '../cli';
import convertWorkspace from '../convert-workspace';

const githubTokenMessage = `
You need to create a github token and place it in a file named 'github-token'.
The token does not need any permissions.

Generate a token here:   https://github.com/settings/tokens

Then:

echo 'PASTE TOKEN HEX HERE' > ./github-token
`;


/**
 * Checks for github-token in the RunnerOptions and if not specified, will look
 * in the github-token file in working folder.  If that doesn't exist either,
 * we message to the user that we need a token and exit the process.
 */
function loadGitHubToken(): string|null {
  // TODO(usergenic): Maybe support GITHUB_TOKEN as an environment variable,
  // since this would be a better solution for Travis deployments etc.
  const githubFilename = 'github-token';
  if (!fs.existsSync(githubFilename)) {
    console.error(`Missing file "${githubFilename}"`);
    return null;
  }
  try {
    return fs.readFileSync(githubFilename, 'utf8').trim();
  } catch (e) {
    console.error(`Unable to load file ${githubFilename}: ${e.message}`);
  }
  return null;
}


export default async function run(options: CliOptions) {
  const workspaceDir = path.resolve(options['workspace-dir']);
  console.log(
      chalk.dim('[1/3]') + ' 🚧  ' +
      chalk.magenta(`Setting Up Workspace "${workspaceDir}"...`));

  if (!options['npm-version']) {
    throw new Error('--npm-version required');
  }

  const npmPackageVersion = options['npm-version']!;
  const githubToken = options['github-token'] || loadGitHubToken();
  if (!githubToken) {
    console.log(githubTokenMessage);
    return;
  }

  const workspace = new Workspace({
    token: githubToken,
    dir: workspaceDir,
  });

  const reposToConvert = await workspace.init(
      {
        include: options['repo']!,
        exclude: options['exclude'],
      },
      {
        fresh: options['clean'],
        verbose: true,
      });

  console.log(
      chalk.dim('[2/3]') + ' 🌀  ' +
      chalk.magenta(`Converting ${reposToConvert.length} Package(s)...`));

  await convertWorkspace({
    workspaceDir,
    npmImportStyle: options['import-style'],
    packageVersion: npmPackageVersion,
    reposToConvert,
  });

  console.log(
      chalk.dim('[3/3]') + ' 🎉  ' + chalk.magenta(`Conversion Complete!`));
}
