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

import * as inquirer from 'inquirer';
import commandLineArgs = require('command-line-args');
import {convertPackage} from './convert-package';
import {readJson} from './manifest-converter';
import * as semver from 'semver';

const optionDefinitions: commandLineArgs.OptionDefinition[] = [
  {
    name: 'help',
    type: Boolean,
    description: 'Show this help message.',
  },
  {
    name: 'out',
    type: String,
    defaultValue: 'html2js_out',
    description: 'The directory to write converted files to.'
  },
  {name: 'in', type: String, description: 'The directory to convert.'},
  {
    name: 'namespace',
    type: String,
    description: 'Namespace name(s) to use to detect exports. ' +
        'Namespaces documented in the code with @namespace will be ' +
        'automatically detected.',
    multiple: true
  },
  {
    name: 'exclude',
    type: String,
    multiple: true,
    description: 'File(s) to exclude from conversion.',
    defaultValue: []
  },
  {
    name: 'include',
    type: String,
    multiple: true,
    description:
        'Root file(s) to include in the conversion. Automatically includes' +
        ' files listed in the bower.json main field, and any file that ' +
        'is HTML imported.',
    defaultValue: []
  },
  {
    name: 'npm-name',
    type: String,
    description: 'npm package name to use for package.json'
  },
  {
    name: 'npm-version',
    type: String,
    description: 'Version string to use for package.json'
  },
  {
    name: 'clear',
    type: Boolean,
    description: 'Clear the out directory (if one exists) before running.',
  },
];

interface Options {
  help?: boolean;
  out: string;
  in ?: string;
  namespace?: string[];
  exclude: string[];
  include: string[];
  'npm-name'?: string;
  'npm-version'?: string;
  clear?: boolean;
}

export async function run() {
  const options: Options = commandLineArgs(optionDefinitions) as any;

  if (options['help']) {
    const getUsage = require('command-line-usage');
    const usage = getUsage([
      {
        header: 'html2js',
        content: 'Convert HTML Imports to JavaScript modules',
      },
      {
        header: 'Options',
        optionList: optionDefinitions,
      }
    ]);
    console.log(usage);
    return;
  }

  // TODO: each file is not always needed, refactor to optimize loading
  let inBowerJson: {name: string, version: string, main: any}|undefined;
  let inPackageJson: {name: string, version: string}|undefined;
  let outPackageJson;
  try {
    outPackageJson = readJson(options.out, 'package.json');
  } catch (e) {
    // do nothing
  }
  try {
    if (options.in) {
      inPackageJson = readJson(options.in, 'package.json');
    }
  } catch (e) {
    // do nothing
  }
  try {
    inBowerJson = readJson('bower.json');
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
  if (!npmPackageName) {
    npmPackageName = (await inquirer.prompt([{
      type: 'input',
      name: 'npm-name',
      message: 'npm package name?',
      default: inBowerJson && `@polymer/${inBowerJson.name}`,
    }]))['npm-name'];
  }

  if (!npmPackageVersion) {
    npmPackageVersion = (await inquirer.prompt([{
      type: 'input',
      name: 'npm-version',
      message: 'npm package version?',
      default: inBowerJson && semver.inc(inBowerJson.version, 'major'),
    }]))['npm-version'];
  }

  await convertPackage({
    inDir: options.in,
    outDir: options.out,
    excludes: options.exclude,
    namespaces: options.namespace,
    packageName: npmPackageName,
    packageVersion: npmPackageVersion,
    clearOutDir: options.clear,
    mainFiles
  });
}
