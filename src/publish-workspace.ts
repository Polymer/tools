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

import chalk from 'chalk';
import * as inquirer from 'inquirer';
import {publishPackagesToNpm, WorkspaceRepo} from 'polymer-workspaces';
import {logRepoError} from './util';

export default async function run(reposToConvert: WorkspaceRepo[]) {
  console.log(
      chalk.dim('[1/3] ') + chalk.magenta(`Setting up publish to npm...`));

  const whoAmI = await reposToConvert[0].npm.whoami();
  console.log(`npm whoami: ${whoAmI}`);
  const {publishTag} = await inquirer.prompt([
    {
      type: 'input',
      name: 'publishTag',
      message: 'publish to npm tag:',
      default: 'next',
    },
  ]);

  console.log('');
  console.log('Ready to publish:');
  for (const repo of reposToConvert) {
    const packageInfo = await repo.npm.getPackageManifest();
    console.log(`  - ${chalk.cyan(publishTag)}: ${packageInfo.name}${
        chalk.dim('@')}${packageInfo.version}`);
  }
  console.log('');

  const {confirmPublish} = (await inquirer.prompt([{
    type: 'confirm',
    name: 'confirmPublish',
    message: 'start?',
    default: true,
  }]));

  if (!confirmPublish) {
    return;
  }

  console.log(chalk.dim('[2/3] ') + chalk.magenta(`Publishing to npm...`));
  const publishResults = await publishPackagesToNpm(reposToConvert, publishTag);
  publishResults.successes.forEach((_result, repo) => {
    console.log(`  - ${chalk.cyan(repo.dir)}: success!`);
  });
  publishResults.failures.forEach(logRepoError);

  console.log(chalk.dim('[3/3]') + ' 🎉  ' + chalk.magenta(`Publish Complete!`));
}
