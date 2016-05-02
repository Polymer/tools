/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as commandLineArgs from 'command-line-args';
import {ArgDescriptor} from 'command-line-args';
import * as path from 'path';
import * as fs from 'fs';
import {args} from './args';
import {startServer, ServerOptions} from './start_server';

export function run(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let argsWithHelp : ArgDescriptor[] = args.concat({
      name: 'help',
      description: 'Shows this help message',
      type: Boolean,
    });
    var cli = commandLineArgs(argsWithHelp);
    try {
      var cliOptions = cli.parse();
    }
    catch (e) {
      printUsage(cli);
      resolve(null);
      return;
    }

    var options: ServerOptions = {
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
      printUsage(cli);
      resolve(null);
    } else if (cliOptions.version) {
      console.log(getVersion());
      resolve(null);
    } else {
      return startServer(options);
    }
  });
}

function printUsage(cli: any): void {
  var usage = cli.getUsage({
    header: 'A development server for Polymer projects',
    title: 'polyserve',
  });
  console.log(usage);
}

function getVersion(): string {
  let packageFilePath = path.resolve(__dirname, '../package.json');
  let packageFile = fs.readFileSync(packageFilePath).toString()
  let packageJson = JSON.parse(packageFile);
  let version = packageJson['version'];
  return version;
}
