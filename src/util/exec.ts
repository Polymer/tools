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

import {ExecOptions} from 'child_process';
import util = require('util');
const {promisify} = util;
const {execFile: _execFile} = require('child_process');
const execFile = promisify(_execFile);

export interface ExecResult {
  stdout: string;
  stderr: string;
}

/**
 * A helper function for working with Node's core execFile() method.
 */
export default async function exec(
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
 * A helper function to check whether a shell command exists or not.
 * Useful for user-facing warnings.
 */
export async function checkCommand(commandName: string): Promise<boolean> {
  try {
    // the "command" command will exit with an error code, which Node
    // will throw from execFile() as an error object.
    await execFile('command', ['-v', commandName]);
    return true;
  } catch (err) {
    return false;
  }
}
