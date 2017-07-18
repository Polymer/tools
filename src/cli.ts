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

import {convertPackage} from './convert-package.js';

import commandLineArgs = require('command-line-args');

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
  {
    name: 'root-module',
    type: String,
    description: 'Root namespace name to use to detect exports.'
  },
  {
    name: 'exclude',
    type: String,
    multiple: true,
    description: 'Exclude a file from conversion.'
  },
  {
    name: 'package-name',
    type: String,
    description: 'npm package name to use for package.json'
  },
  {
    name: 'npm-version',
    type: String,
    description: 'Version string to use for package.json'
  },
];

export async function run() {
  const options = commandLineArgs(optionDefinitions);

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

  await convertPackage({
    outDir: options['out'],
    excludes: options['exclude'],
    rootModuleName: options['root-module'],
    packageName: options['package-name'],
    npmVersion: options['npm-version'],
  });

  console.log('Done');
}
