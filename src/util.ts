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
import chalk from 'chalk';
import {ExecOptions} from 'child_process';
import {Iterable as IterableX} from 'ix';
import * as fs from 'mz/fs';
import * as path from 'path';
import {WorkspaceRepo} from 'polymer-workspaces';

import {ConvertedDocumentFilePath} from './urls/types';

import _mkdirp = require('mkdirp');
import _rimraf = require('rimraf');
const {promisify} = require('util');
const {execFile: _execFile} = require('child_process');
const execFile = promisify(_execFile);


/**
 * Helper promisified "mkdirp" library function.
 */
export const mkdirp = promisify(_mkdirp);

/**
 * Helper promisified "rimraf" library function.
 */
export const rimraf = promisify(_rimraf);


/**
 * Write each file to the out-directory.
 */
export async function writeFileResults(
    outDir: string, files: Map<ConvertedDocumentFilePath, string|undefined>) {
  return Promise.all(IterableX.from(files).map(async ([newPath, newSource]) => {
    const filePath = path.join(outDir, newPath);
    await mkdirp(path.dirname(filePath));
    if (newSource !== undefined) {
      await fs.writeFile(filePath, newSource);
    } else if (await fs.exists(filePath)) {
      await fs.unlink(filePath);
    }
  }));
}

/**
 * The exec() helper return type.
 */
export interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * A helper function for working with Node's core execFile() method.
 */
export async function exec(
    cwd: string, command: string, args?: string[], options?: ExecOptions):
    Promise<ExecResult> {
  const commandOptions = {...options, cwd: cwd} as ExecOptions;
  try {
    const {stdout, stderr} = await execFile(command, args, commandOptions);
    // Trim unneccesary extra newlines/whitespace from exec/execFile output
    return {stdout: stdout.trim(), stderr: stderr.trim()};
  } catch (err) {
    // If an error happens, attach the working directory to the error object
    err.cwd = cwd;
    throw err;
  }
}

/**
 * Log an error that occurred when performing some task on a workspace repo.
 */
export function logRepoError(err: Error, repo: WorkspaceRepo) {
  const repoDirName = path.basename(repo.dir);
  console.error(`${repoDirName}: ${err.message}`);
}

/**
 * Log a user-facing message about progress through some set of steps.
 */
export function logStep(
    stepNum: number, totalNum: number, emoji: string, msg: string) {
  const stepInfo = `[${stepNum}/${totalNum}]`;
  console.log(`${chalk.dim(stepInfo)} ${emoji}  ${chalk.magenta(msg)}`);
}
