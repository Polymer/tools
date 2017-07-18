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

// Install source map support for stack traces, etc.
require('source-map-support').install();

import * as fs from 'mz/fs';
import * as path from 'path';
import {configureAnalyzer, configureConverter} from '../convert-package';

import diff = require('diff');
import chalk = require('chalk');

const fixturesDirPath =
    path.resolve(__dirname, '../../fixtures/generated/polymer');
const sourceDir = path.join(fixturesDirPath, 'source');
const expectedDir = path.join(fixturesDirPath, 'expected');

function rework(line: string) {
  if (!line) {
    return null;
  }
  switch (line[0]) {
    case '@':
      return null;
    case '\\':
      return null;
    case '+':
      return '  ' + chalk.green(line);
    case '-':
      return '  ' + chalk.red(line);
    case ' ':
      return '  ' + line;
    default:
      return '  ' + line;
  }
}

(async () => {
  let exitCode = 0;

  try {
    console.assert(fs.statSync(sourceDir).isDirectory());
    console.assert(fs.statSync(expectedDir).isDirectory());
  } catch (err) {
    console.log(
        'Error: No checkpoint found, run `yarn run polymer:checkpoint` to generate a good checkpoint to compare against.');
    process.exit(1);
  }

  const analyzer = configureAnalyzer({
    inDir: sourceDir,
  });
  const analysis = await analyzer.analyzePackage();
  const converter = configureConverter(analysis, {});
  const resultsUnsorted = await converter.convert();
  const results = [...resultsUnsorted.entries()].sort((a, b) => {
    const aPath = a[0];
    const bPath = b[0];
    return aPath.localeCompare(bPath);
  });
  for (const [jsPath, jsContents] of results) {
    const expectedJsPath = path.resolve(expectedDir, jsPath);
    const expectedJsContents = fs.readFileSync(expectedJsPath, 'utf8');

    const patch = diff.createPatch(
        'string', jsContents, expectedJsContents, 'converted', 'expected');
    const lines = patch.split('\n').slice(4).map(rework).filter(Boolean);
    if (lines.length === 0) {
      console.log(chalk.dim('✓ ' + jsPath));
    } else {
      exitCode = 1;
      console.log(chalk.bold.red('✕ ' + jsPath));
      console.log('');
      console.log(lines.join('\n'));
      console.log('');
    }
  }
  console.log('');

  process.exit(exitCode);
})();
