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

import * as fsExtra from 'fs-extra';
import * as path from 'path';

import {Config, generateDeclarations} from './gen-ts';

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
    name: 'config',
    type: String,
    description:
        'JSON configuration file (default "<root>/gen-tsd.json" if exists).',
  },
  {
    name: 'outDir',
    type: String,
    description:
        'Type declarations output directory (default concatenated to stdout).',
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

  if (!args.config) {
    const p = path.join(args.root, 'gen-tsd.json');
    if (await fsExtra.pathExists(p)) {
      args.config = p;
    }
  }
  let config: Config = {};
  if (args.config) {
    console.info(`Loading config from "${args.config}".`);
    config = JSON.parse(await fsExtra.readFile(args.config, 'utf8')) as Config;
  }

  const fileMap = await generateDeclarations(args.root, config);

  if (args.outDir) {
    console.log('Writing type declarations to ' + path.resolve(args.outDir));
    await writeFileMap(args.outDir, fileMap);
  } else {
    const concatenated = [...fileMap.values()].join('\n');
    process.stdout.write(concatenated);
  }
}

async function writeFileMap(
    rootDir: string, files: Map<string, string>): Promise<void> {
  const promises = [];
  for (const [relPath, contents] of files) {
    const fullPath = path.join(rootDir, relPath);
    promises.push(fsExtra.outputFile(fullPath, contents));
  }
  await Promise.all(promises);
}

(async () => {
  try {
    await run(process.argv);
  } catch (e) {
    console.error(e);
    process.exit(1);
  }
})();
