/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

import * as fse from 'fs-extra';
import * as path from 'path';
import {exec, ExecResult} from '../../util';

const modulizerBinPath = path.resolve(__dirname, '../../../bin/modulizer.js');

export interface TestConfig {
  options: string[];
  stdout: string;
  stderr: string;
}

export async function runFixture(
    sourceDir: string, resultDir: string, testConfig: TestConfig):
    Promise<ExecResult> {
  await fse.emptyDir(resultDir);
  await fse.copy(sourceDir, resultDir);

  // Top-Level Integration Test! Test the CLI interface directly.
  return await exec(resultDir, 'node', [
    modulizerBinPath,
    '--out',
    '.',
    '--force',
  ].concat(testConfig.options || []));
}
