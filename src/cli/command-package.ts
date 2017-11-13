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
import * as inquirer from 'inquirer';
import * as path from 'path';
import * as semver from 'semver';

import {CliOptions} from '../cli';
import convertPackage from '../convert-package';
import {readJson} from '../manifest-converter';
import {exec} from '../util';

export default async function run(options: CliOptions) {
  const inDir = path.resolve(options.in || process.cwd());
  const outDir = path.resolve(options.out);

  // Ok, we're updating a package in a directory not under our control.
  // We need to be sure it's safe.
  const {stdout, stderr} = await exec(inDir, 'git', ['status', '-s']);
  if (!options.force && (stdout || stderr)) {
    console.error(
        `Git repo is dirty. Check all changes in to source control and ` +
        `then try again.`);
    process.exit(1);
  }

  // TODO: each file is not always needed, refactor to optimize loading
  let inBowerJson: {name: string, version: string, main: any}|undefined;
  let inPackageJson: {name: string, version: string}|undefined;
  let outPackageJson: {name: string, version: string}|undefined;
  try {
    outPackageJson = readJson(outDir, 'package.json');
  } catch (e) {
    // do nothing
  }
  try {
    if (options.in) {
      inPackageJson = readJson(inDir, 'package.json');
    }
  } catch (e) {
    // do nothing
  }
  try {
    inBowerJson = readJson(inDir, 'bower.json');
  } catch (e) {
    // do nothing
  }

  let npmPackageName = options['npm-name'] ||
      inPackageJson && inPackageJson.name ||
      outPackageJson && outPackageJson.name;
  let npmPackageVersion = options['npm-version'] ||
      inPackageJson && inPackageJson.version ||
      outPackageJson && outPackageJson.version;

  let bowerMainAny = (inBowerJson && inBowerJson.main) || [];
  if (!Array.isArray(bowerMainAny)) {
    bowerMainAny = [bowerMainAny];
  }
  const bowerMain: string[] =
      bowerMainAny.filter((m: any) => typeof m === 'string');

  const mainFiles = [...bowerMain, ...options.include];

  // Prompt user for new package name & version if none exists
  // TODO(fks) 07-19-2017: Add option to suppress prompts
  if (typeof npmPackageName !== 'string') {
    npmPackageName = (await inquirer.prompt([{
                       type: 'input',
                       name: 'npm-name',
                       message: 'npm package name?',
                       default: inBowerJson && `@polymer/${inBowerJson.name}`,
                     }]))['npm-name'] as string;
  }

  if (typeof npmPackageVersion !== 'string') {
    npmPackageVersion =
        (await inquirer.prompt([{
          type: 'input',
          name: 'npm-version',
          message: 'npm package version?',
          default: inBowerJson && semver.inc(inBowerJson.version, 'major'),
        }]))['npm-version'] as string;
  }

  console.log(
      chalk.dim('[1/2]') + ' 🌀  ' + chalk.magenta(`Converting Package...`));

  await convertPackage({
    inDir: inDir,
    outDir: outDir,
    excludes: options.exclude,
    namespaces: options.namespace,
    packageName: npmPackageName.toLowerCase(),
    packageVersion: npmPackageVersion,
    cleanOutDir: options.clean!!,
    mainFiles,
  });

  console.log(
      chalk.dim('[2/2]') + ' 🎉  ' + chalk.magenta(`Conversion Complete!`));
}
