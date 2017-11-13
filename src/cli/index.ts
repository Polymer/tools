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

import * as commandLineArgs from 'command-line-args';

import runPackageCommand from './command-package';
import runWorkspaceCommand from './command-workspace';

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
    defaultValue: 'modulizer_workspace',
    description:
        'Override the default path "modulizer_workspace" where the repositories ' +
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
    defaultValue: 'modulizer_out',
    description: 'The directory to write converted files to.'
  },
  {
    name: 'in',
    type: String,
    description: 'The directory to convert.'
  },
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
    name: 'clean',
    type: Boolean,
    defaultValue: false,
    description: 'If given, clear the existing build/workspace folder ' +
        +'before beginning.'
  },
  {
    name: 'force',
    type: Boolean,
    defaultValue: false,
    description:
        `If given, may overwrite or delete files when converting the given ` +
        `input directory.`,
  },
];

export interface CliOptions {
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
  clean: boolean;
  'workspace-dir': string;
  'github-token'?: string;
  force: boolean;
}

export async function run() {
  const options: CliOptions = commandLineArgs(optionDefinitions) as any;

  if (options['help']) {
    const getUsage = require('command-line-usage');
    const usage = getUsage([
      {
        header: 'modulizer',
        content: `Convert HTML Imports to JavaScript modules

If no GitHub repository names are given, modulizer converts the current
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
    await runWorkspaceCommand(options);
    return;
  }

  await runPackageCommand(options);
}
