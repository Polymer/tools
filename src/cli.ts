/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import {ArgDescriptor} from 'command-line-args';
import * as path from 'path';
import * as fs from 'fs';
import {args} from './args';
import {startServer, ServerOptions} from './start_server';

import commandLineArgs = require('command-line-args');
import commandLineUsage = require('command-line-usage');

export async function run(): Promise<void> {
  const argsWithHelp : ArgDescriptor[] = args.concat({
    name: 'help',
    description: 'Shows this help message',
    type: Boolean,
  });

  let cliOptions: any;

  try {
    cliOptions = commandLineArgs(argsWithHelp);
  } catch (e) {
    printUsage(argsWithHelp);
    return;
  }

  const options: ServerOptions = {
    root: cliOptions.root,
    port: cliOptions.port,
    hostname: cliOptions.hostname,
    open: cliOptions.open,
    browser: cliOptions['browser'],
    openPath: cliOptions['open-path'],
    componentDir: cliOptions['component-dir'],
    packageName: cliOptions['package-name'],
  }

  if (cliOptions.help) {
    printUsage(argsWithHelp);
  } else if (cliOptions.version) {
    console.log(getVersion());
  } else {
    await startServer(options);
  }

}

function printUsage(options: any): void {
  const usage = commandLineUsage([{
    header: 'A development server for Polymer projects',
    title: 'polyserve',
    optionList: options,
  }]);
  console.log(usage);
}

function getVersion(): string {
  let packageFilePath = path.resolve(__dirname, '../package.json');
  let packageFile = fs.readFileSync(packageFilePath).toString()
  let packageJson = JSON.parse(packageFile);
  let version = packageJson['version'];
  return version;
}
