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
import {NpmImportStyle, PackageType} from '../conversion-settings';

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
    name: 'delete-files',
    type: String,
    multiple: true,
    description:
        'After conversion, delete all files that match any of these glob ' +
        'patterns.',
    defaultValue: []
  },
  {
    name: 'dependency-mapping',
    type: String,
    multiple: true,
    description: 'A set of mapping instructions to map unknown bower ' +
        'dependencies to npm. ' +
        'Must be of the format: "[bower name],[npm name],[npm semver range]".' +
        'Example: "polymer,@polymer/polymer,^X.X.X". ' +
        'Multiple mappings allowed.',
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
  {
    name: 'install',
    type: Boolean,
    defaultValue: false,
    description:
        `If given, installs dependencies in all repos after workspace conversion.`,
  },
  {
    name: 'test',
    type: Boolean,
    defaultValue: false,
    description: `Run tests after workspace conversion.`,
  },
  {
    name: 'push',
    type: Boolean,
    defaultValue: false,
    description:
        `Push changes to GitHub after conversion (will prompt to confirm).`,
  },
  {
    name: 'publish',
    type: Boolean,
    defaultValue: false,
    description:
        `Publish changes to npm after conversion (will prompt to confirm).`,
  },
  {
    name: 'import-style',
    type: String,
    defaultValue: 'path',
    description:
        `[name|path] The desired format for npm package import URLs/specifiers. ` +
        `Defaults to "path".`,
  },
  {
    name: 'add-import-meta',
    type: Boolean,
    defaultValue: false,
    description: `Whether to add a static importMeta property to ` +
        `elements. Defaults to false`,
  },
  {
    name: 'flat',
    type: Boolean,
    defaultValue: false,
    description:
        `Whether to set flat:true in the newly generated package.json.`,
  },
  {
    name: 'private',
    type: Boolean,
    defaultValue: false,
    description:
        `Whether to set private:true in the newly generated package.json.`,
  },
  {
    name: 'package-type',
    type: String,
    defaultValue: 'element',
    description:
        `[element|application] The type of package that is to be modulized. ` +
        `Defaults to "element"`,
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
  'delete-files': string[];
  'dependency-mapping': string[];
  'npm-name'?: string;
  'npm-version'?: string;
  clean: boolean;
  'workspace-dir': string;
  'github-token'?: string;
  force: boolean;
  install: boolean;
  test: boolean;
  push: boolean;
  publish: boolean;
  'import-style': NpmImportStyle;
  'add-import-meta': boolean;
  flat: boolean;
  'private': boolean;
  'package-type': PackageType;
}

export async function run() {
  const options = commandLineArgs(optionDefinitions) as CliOptions;

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
    console.log(require('../../package.json').version);
    return;
  }

  if (options['repo']) {
    await runWorkspaceCommand(options);
    return;
  }

  const importStyle = options['import-style'];
  if (importStyle !== 'name' && importStyle !== 'path') {
    throw new Error(
        `import-style "${importStyle}" not supported. ` +
        `Supported styles: "name", "path".`);
  }

  const packageType = options['package-type'];
  if (packageType !== 'element' && packageType !== 'application') {
    throw new Error(
        `package-type "${packageType}" is not supported. ` +
        `Supported types: "element", "application".`);
  }

  await runPackageCommand(options);
}
