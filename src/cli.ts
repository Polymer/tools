/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved. This
 * code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be
 * found at http://polymer.github.io/AUTHORS.txt The complete set of
 * contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt Code
 * distributed by Google as part of the polymer project is also subject to an
 * additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as fs from 'fs';
import {generateDeclarations} from './gen-ts';

const commandLineArgs = require('command-line-args') as any;
const commandLineUsage = require('command-line-usage') as any;

const argDefs = [
  {
    name: 'help',
    type: Boolean,
    description: 'Print this help text.',
  },
  {
    name: 'version',
    type: Boolean,
    description: 'Print the installed version.',
  },
  {
    name: 'root',
    type: String,
    defaultValue: '.',
    description: 'Root directory of the package to analyze (default ".").',
  },
  {
    name: 'out',
    type: String,
    description: 'Type declarations output file path (default stdout).',
  },
];

async function run(argv: string[]) {
  const args = commandLineArgs(argDefs, {argv});

  if (args.help) {
    console.log(commandLineUsage([
      {
        header: `gen-typescript-declarations`,
        content: 'https://github.com/Polymer/gen-typescript-declarations',
      },
      {
        header: `Options`,
        optionList: argDefs,
      }
    ]));
    return;
  }

  if (args.version) {
    console.log(require('../package.json').version);
    return;
  }

  const declarations = await generateDeclarations(args.root);

  if (args.out) {
    fs.writeFileSync(args.out, declarations);
  } else {
    process.stdout.write(declarations);
  }
}

(async () => {
  try {
    await run(process.argv);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
