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
const {promisify} = require('util');
const {exec: _exec} = require('child_process');
const exec = promisify(_exec);

export default async function(
    cwd: string, command: string, options?: ExecOptions):
    Promise<[string, string]> {
  const commandOptions = Object.assign({}, options, {cwd});
  const {stdout, stderr} = await exec(command, commandOptions);
  return [stdout.toString('utf8').trim(), stderr.toString('utf8').trim()];
}

export async function checkCommand(commandName: string): Promise<boolean> {
  try {
    const {stdout} = await exec(
        'command -v ' + commandName + ' 2>/dev/null' +
        ' && { echo >&1 \'' + commandName + ' found\'; exit 0; }');
    return !!stdout;
  } catch (err) {
    return false;
  }
}
