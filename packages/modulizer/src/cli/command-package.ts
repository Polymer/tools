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
import * as fse from 'fs-extra';
import * as inquirer from 'inquirer';
import * as path from 'path';
import * as semver from 'semver';

import {CliOptions} from '../cli';
import convertPackage from '../convert-package';
import {saveDependencyMapping} from '../package-manifest';
import {exec, logStep} from '../util';

import {parseDependencyMappingInput} from './util';

export default async function run(options: CliOptions) {
  const inDir = path.resolve(options.in || process.cwd());
  const outDir = path.resolve(options.out);

  // Ok, we're updating a package in a directory not under our control.
  // We need to be sure it's safe.
  let stdout, stderr;
  let isRepo = true;
  try {
    ({stdout, stderr} = await exec(inDir, 'git', ['status', '-s']));
  } catch (e) {
    // Grab command execution results from exception info.
    ({stdout, stderr} = e);
    isRepo =
        stderr === undefined || stderr.indexOf('Not a git repository') === -1;
  }
  if (!isRepo) {
    console.warn(`Not a git repo, proceeding.`);
  }
  if (!options.force && isRepo && (stdout || stderr)) {
    console.error(
        `Git repo is dirty. Check all changes in to source control and ` +
        `then try again.`);
    process.exit(1);
  }

  for (const rawMapping of options['dependency-mapping']) {
    try {
      const [bowerName, npmName, npmSemver] =
          parseDependencyMappingInput(rawMapping);
      saveDependencyMapping(bowerName, npmName, npmSemver);
    } catch (err) {
      console.error(err.message);
      process.exit(1);
    }
  }

  // TODO: each file is not always needed, refactor to optimize loading
  let inBowerJson: {name: string, version: string, main: string}|undefined;
  let inPackageJson: {name: string, version: string}|undefined;
  let outPackageJson: {name: string, version: string}|undefined;
  try {
    outPackageJson = await fse.readJSON(path.join(outDir, 'package.json'));
  } catch (e) {
    // do nothing
  }
  try {
    if (options.in) {
      inPackageJson = await fse.readJson(path.join(inDir, 'package.json'));
    }
  } catch (e) {
    // do nothing
  }
  try {
    inBowerJson = await fse.readJson(path.join(inDir, 'bower.json'));
  } catch (e) {
    // do nothing
  }

  let npmPackageName = options['npm-name'] ||
      inPackageJson && inPackageJson.name ||
      outPackageJson && outPackageJson.name;
  let npmPackageVersion = options['npm-version'] ||
      inPackageJson && inPackageJson.version ||
      outPackageJson && outPackageJson.version;

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

  logStep(1, 2, '🌀', `Converting Package...`);
  console.log(`Out directory: ${outDir}`);
  await convertPackage({
    inDir: inDir,
    outDir: outDir,
    excludes: options.exclude,
    deleteFiles: options['delete-files'],
    namespaces: options.namespace,
    npmImportStyle: options['import-style'],
    packageName: npmPackageName.toLowerCase(),
    packageVersion: npmPackageVersion,
    cleanOutDir: options.clean!!,
    addImportMeta: options['add-import-meta'],
    flat: options.flat,
    private: options.private,
    packageType: options['package-type']
  });

  logStep(2, 2, '🎉', `Conversion Complete!`);
}
