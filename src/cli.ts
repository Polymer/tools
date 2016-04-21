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
import {args} from './args';
import {startServer} from './start_server';

export function run(): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let argsWithHelp : ArgDescriptor[] = args.concat({
      name: 'help',
      description: 'Shows this help message',
      type: Boolean,
    });
    var cli = commandLineArgs(argsWithHelp);
    var options = cli.parse();

    if (options.help) {
      var usage = cli.getUsage({
        header: 'Runs the polyserve development server',
        title: 'polyserve',
      });
      console.log(usage);
      resolve();
    } else {
      return startServer(options);
    }
  });
}
