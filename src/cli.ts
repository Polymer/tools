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

import * as fs from 'fs';
import * as inquirer from 'inquirer';
import commandLineArgs = require('command-line-args');
import {convertPackage} from './convert-package';
import {readJson} from './manifest-converter';
import * as semver from 'semver';
import {Runner} from './workspace/sync-workspace';
import {convertWorkspace} from './convert-workspace';

const githubTokenMessage = `
You need to create a github token and place it in a file named 'github-token'.
The token does not need any permissions.

Generate a token here:   https://github.com/settings/tokens

Then:

echo 'PASTE TOKEN HEX HERE' > ./github-token
`;

const optionDefinitions: commandLineArgs.OptionDefinition[] = [
  {
    name: 'repo',
    alias: 'r',
    type: String,
    multiple: true,
    description:
        'Repositories to convert.  (This is the default option, so the ' +
        '--repo/-r switch itself is not required.)',
    defaultOption: true
  },
  {
    name: 'workspace-dir',
    alias: 'd',
    type: String,
    defaultValue: 'html2js_workspace',
    description:
        'Override the default path "html2js_workspace" where the repositories ' +
        'will be cloned to.'
  },
  {
    name: 'github-token',
    alias: 'g',
    type: String,
    description: 'Provide github token via command-line flag instead of ' +
        '"github-token" file.'
  },
  {
    name: 'help',
    type: Boolean,
    description: 'Show this help message.',
  },
  {
    name: 'version',
    type: Boolean,
    description: 'Display the version number and exit',
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
  repo?: string[];
  help?: boolean;
  version?: boolean;
  out: string;
  'in'?: string;
  namespace?: string[];
  exclude: string[];
  include: string[];
  'npm-name'?: string;
  'npm-version'?: string;
  clear?: boolean;
  'workspace-dir'?: string;
  'github-token'?: string;
}

export async function run() {
  const options: Options = commandLineArgs(optionDefinitions) as any;

  if (options['help']) {
    const getUsage = require('command-line-usage');
    const usage = getUsage([
      {
        header: 'html2js',
        content: `Convert HTML Imports to JavaScript modules

If no GitHub repository names are given, html2js converts the current
directory as a package. If repositories are provided, they are cloned into a
workspace directory as sibling folders as they would be in a Bower
installation.
`,
      },
      {
        header: 'Options',
        optionList: optionDefinitions,
      }
    ]);
    console.log(usage);
    return;
  }

  if (options['version']) {
    console.log(require('../package.json').version);
    return;
  }

  if (options['repo']) {
    console.log(
        `Repositories specified, using workspace ${options['workspace-dir']}`);

    loadGitHubToken(options);
    if (!options['github-token']) {
      console.error(githubTokenMessage);
      return;
    }
    const runner = new Runner({
      repos: options['repo'] as string[],
      githubToken: options['github-token'] as string,
      workspaceDir: options['workspace-dir']!,
    });
    const {dir, repos} = await runner.run();
    convertWorkspace({
      inDir: dir,
      repos: [...repos.keys()],
      packageVersion: options['npm-version']
    });
    return;
  }

  // TODO: each file is not always needed, refactor to optimize loading
  let inBowerJson: {name: string, version: string, main: any}|undefined;
  let inPackageJson: {name: string, version: string}|undefined;
  let outPackageJson: {name: string, version: string}|undefined;
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

  await convertPackage({
    inDir: options.in,
    outDir: options.out,
    excludes: options.exclude,
    namespaces: options.namespace,
    packageName: npmPackageName.toLowerCase(),
    packageVersion: npmPackageVersion,
    clearOutDir: options.clear,
    mainFiles
  });
}


/**
 * Checks for github-token in the RunnerOptions and if not specified, will look
 * in the github-token file in working folder.  If that doesn't exist either,
 * we message to the user that we need a token and exit the process.
 */
function loadGitHubToken(options: Options) {
  // TODO(usergenic): Maybe support GITHUB_TOKEN as an environment variable,
  // since this would be a better solution for Travis deployments etc.
  const githubFilename = 'github-token';
  if (!options['github-token']) {
    if (!fs.existsSync(githubFilename)) {
      console.error(`Missing file "${githubFilename}"`);
      return;
    }
    try {
      options['github-token'] = fs.readFileSync(githubFilename, 'utf8').trim();
    } catch (e) {
      console.error(`Unable to load file ${githubFilename}: ${e.message}`);
    }
  }
}
