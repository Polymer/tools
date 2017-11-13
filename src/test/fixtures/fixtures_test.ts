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

import {assert} from 'chai';
import * as chalk from 'chalk';
import * as diff from 'diff';
import * as fs from 'mz/fs';
import * as path from 'path';
import * as rimraf from 'rimraf';

import exec from '../util/exec';

// Install source map support for stack traces, etc.
require('source-map-support').install();
// TODO(fks): Add 'dir-compare' typings.
const dircompare = require('dir-compare');

const modulizerBinPath = path.resolve(__dirname, '../../../bin/modulizer.js');
const packageFixturesDir =
    path.resolve(__dirname, '../../../fixtures/packages');


/**
 * Pretty-format a full diff patch for console reporting.
 */
function formatDiffPatch(patch: string) {
  return patch.split('\n')
      .slice(4)
      .map(formatDiffLine)
      .filter(Boolean)
      .join('\n');
}

/**
 * Pretty-format a single line from a diff patch for console reporting.
 */
function formatDiffLine(line: string) {
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

/**
 * Create a human-readable, pretty-printed report for the diff results of two
 * directories.
 */
function createDiffConflictOutput(diffResult: any): string {
  const errorOutputLines = ['Converted fixture does not match expected:', ''];
  diffResult.diffSet.forEach(function(entry: any) {
    switch (entry.state) {
      case 'equal':
        return;
      case 'left':
        const expectedFileRelPath =
            path.join(entry.relativePath || '/', entry.name1);
        errorOutputLines.push((chalk.bold.green(' + ' + expectedFileRelPath)));
        return;
      case 'right':
        const actualFileRelPath =
            path.join(entry.relativePath || '/', entry.name2);
        errorOutputLines.push((chalk.bold.red(' - ' + actualFileRelPath)));
        return;
      case 'distinct':
        const diffedFileRelPath =
            path.join(entry.relativePath || '/', entry.name1);
        const expectedFilePath = path.join(entry.path1, entry.name1);
        const actualFilePath = path.join(entry.path2, entry.name2);
        const patch = diff.createPatch(
            'string',
            fs.readFileSync(expectedFilePath, 'utf8'),
            fs.readFileSync(actualFilePath, 'utf8'),
            'expected',
            'converted');
        errorOutputLines.push((chalk.bold.red('<> ' + diffedFileRelPath)));
        errorOutputLines.push(formatDiffPatch(patch));
        return;
      default:
        throw new Error('Unexpected diff-entry format: ' + entry);
    }
  });
  return errorOutputLines.concat(['']).join('\n');
}

suite('Fixtures', () => {

  suite('Packages', function() {

    this.timeout(60000);

    for (const fixtureBasename of fs.readdirSync(packageFixturesDir)) {
      const fixtureDir = path.join(packageFixturesDir, fixtureBasename);
      if (!fs.statSync(fixtureDir).isDirectory()) {
        continue;
      }

      test(`packages/${fixtureBasename}`, async () => {
        const fixtureSourceDir = path.join(fixtureDir, 'source');
        const fixtureExpectedDir = path.join(fixtureDir, 'expected');
        const fixtureResultDir = path.join(fixtureDir, 'generated');
        const fixtureTestConfig = require(path.join(fixtureDir, 'test.js'));
        assert.isOk(fs.statSync(fixtureSourceDir).isDirectory());
        assert.isOk(fs.statSync(fixtureExpectedDir).isDirectory());
        rimraf.sync(fixtureResultDir);

        // Top-Level Integration Test! Test the CLI interface directly.
        const output = await exec(
            fixtureSourceDir,
            'node',
            [modulizerBinPath, '--out', '../generated/', '--force'].concat(
                fixtureTestConfig.options || []));

        // 1. Check stderr output that no (unexpected) errors were emitted.
        assert.equal(output.stderr, (fixtureTestConfig.stderr || ''));

        // 2. Compare the generated output to the expected conversion.
        //    Output the diff & fail if any differences are encountered.
        const diffResult = dircompare.compareSync(
            fixtureResultDir, fixtureExpectedDir, {compareSize: true});
        if (!diffResult.same) {
          const diffOutput = createDiffConflictOutput(diffResult);
          throw new Error(diffOutput);
        }

        // 1. Check stdout output that no (unexpected) output was emitted.
        assert.equal(output.stdout, (fixtureTestConfig.stdout || ''));
      });
    }

  });

});
