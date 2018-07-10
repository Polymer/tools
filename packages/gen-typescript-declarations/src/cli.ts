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
import * as glob from 'glob';
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
    description: 'Type declarations output directory (required).',
  },
  {
    name: 'deleteExisting',
    type: Boolean,
    description: 'Recursively delete all .d.ts files in <outDir> before ' +
        'writing new typings, excluding node_modules/, bower_components/, ' +
        'or any file added using the <addReferences> config option.',
  },
];

interface args {
  help?: boolean;
  version?: boolean;
  root: string;
  config?: string;
  outDir?: string;
  deleteExisting?: boolean;
}

async function run(argv: string[]) {
  const args = commandLineArgs(argDefs, {argv}) as args;

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

  if (!args.outDir) {
    throw new Error('--outDir is required');
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

  if (args.deleteExisting) {
    let dtsFiles = glob.sync('**/*.d.ts', {
      cwd: args.outDir,
      absolute: true,
      nodir: true,
      ignore: [
        'node_modules/**',
        'bower_components/**',
      ]
    });

    // If the addReferences option is being used, it's probably to add some
    // manually written typings. Since manually written typing files won't get
    // re-generated, we shouldn't delete them.
    const dontDelete = new Set<string>();
    for (const refs of Object.values(config.addReferences || {})) {
      for (const ref of refs) {
        dontDelete.add(path.resolve(args.root, ref));
      }
    }
    dtsFiles = dtsFiles.filter((filepath) => !dontDelete.has(filepath));

    console.log(
        `Deleting ${dtsFiles.length} existing d.ts files from ` +
        `${path.resolve(args.outDir)}`);
    await Promise.all(dtsFiles.map((filepath) => fsExtra.remove(filepath)));
  }

  console.log('Writing type declarations to', path.resolve(args.outDir));
  await writeFileMap(args.outDir, fileMap);
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
