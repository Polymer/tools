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

// Be mindful of adding imports here, as this is on the hot path of all
// commands.

import * as fs from 'fs';
import * as inquirer from 'inquirer';
import {execSync} from 'mz/child_process';
import * as path from 'path';
import {ProjectConfig} from 'polymer-project-config';

/**
 * Check if the current shell environment is MinGW. MinGW can't handle some
 * yeoman features, so we can use this check to downgrade gracefully.
 */
function checkIsMinGW(): boolean {
  const isWindows = /^win/.test(process.platform);
  if (!isWindows) {
    return false;
  }

  // uname might not exist if using cmd or powershell,
  // which would throw an exception
  try {
    const uname = execSync('uname -s').toString();
    return !!/^mingw/i.test(uname);
  } catch (error) {
    return false;
  }
}

/**
 * A wrapper around inquirer prompt that works around its awkward (incorrect?)
 * typings, and is intended for asking a single list-based question.
 */
export async function prompt(
    question: {message: string, choices: inquirer.ChoiceType[]}):
    Promise<string> {
  // Some windows emulators (mingw) don't handle arrows correctly
  // https://github.com/SBoudrias/Inquirer.js/issues/266
  // Fall back to rawlist and use number input
  // Credit to
  // https://gist.github.com/geddski/c42feb364f3c671d22b6390d82b8af8f
  const rawQuestion = {
    type: checkIsMinGW() ? 'rawlist' : 'list',
    name: 'foo',
    message: question.message,
    choices: question.choices,
  };

  // TODO(justinfagnani): the typings for inquirer appear wrong
  // tslint:disable-next-line: no-any
  const answers = await inquirer.prompt([rawQuestion] as any);
  return answers.foo;
}

export function indent(str: string, additionalIndentation = '  ') {
  return str.split('\n')
      .map((s) => s ? additionalIndentation + s : '')
      .join('\n');
}

export function dashToCamelCase(text: string): string {
  return text.replace(/-([a-z])/g, (v) => v[1].toUpperCase());
}

/**
 * Gets the root source files of the project, for analysis & linting.
 *
 * First looks for explicit options on the command line, then looks in
 * the config file. If none are specified in either case, returns undefined.
 *
 * Returned file paths are relative from config.root.
 */
export async function getProjectSources(
    options: {input?: Array<string>},
    config: ProjectConfig): Promise<string[]|undefined> {
  const globby = await import('globby');

  if (options.input !== undefined && options.input.length > 0) {
    // Files specified from the command line are relative to the current
    //   working directory (which is usually, but not always, config.root).
    const absPaths = await globby(options.input, {root: process.cwd()});
    return absPaths.map((p) => path.relative(config.root, p));
  }
  const candidateFiles = await globby(config.sources, {root: config.root});
  candidateFiles.push(...config.fragments);
  if (config.shell) {
    candidateFiles.push(config.shell);
  }
  /**
   *  A project config will always have an entrypoint of
   * `${config.root}/index.html`, even if the polymer.json file is
   * totally blank.
   *
   * So we should only return config.entrypoint here if:
   *   - the user has specified other sources in their config file
   *   - and if the entrypoint ends with index.html, we only include it if it
   *     exists on disk.
   */
  if (candidateFiles.length > 0 && config.entrypoint) {
    if (!config.entrypoint.endsWith('index.html') ||
        fs.existsSync(config.entrypoint)) {
      candidateFiles.push(config.entrypoint);
    }
  }
  if (candidateFiles.length > 0) {
    // Files in the project config are all absolute paths.
    return [...new Set(
        candidateFiles.map((absFile) => path.relative(config.root, absFile)))];
  }
  return undefined;
}
