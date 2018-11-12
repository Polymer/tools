/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as chalk from 'chalk';
import {spawnSync} from 'child_process';
import * as Mocha from 'mocha';

const retryTargets: string[] =
    parseJSONArray(process.env['TEST_RETRY_TARGETS']);
const retryTargetMax = parseInt(process.env['TEST_RETRY_TARGET_MAX'], 10) || 0;
const retryCount = parseInt(process.env['TEST_RETRY_COUNT'], 10) || 0;
const retryMax = parseInt(process.env['TEST_RETRY_MAX'], 10) || 3;

const initialCurrentWorkingDirectory = process.cwd();

/**
 * The `mocha` command-line *requires* the reporter module to export via:
 * `module.exports =`.
 */
module.exports = class RetryFailuresReporter extends Mocha.reporters.Spec {
  constructor(runner: Mocha.Runner) {
    super(runner);

    const passed: string[] = [];
    const fails: string[] = [];

    runner.on('pass', (test: Mocha.Test) => passed.push(getFullTitle(test)));

    runner.on(
        'fail', (test: Mocha.Test, _: Error) => fails.push(getFullTitle(test)));

    runner.on('end', () => {
      if (retryTargets.length > 0) {
        const missedTargets =
            getMissedTargets(passed.concat(fails), retryTargets);
        if (missedTargets.length > 0) {
          runner.abort();
          console.error(banner(
              `Failed to run intented test target(s):\n` +
              missedTargets.map((t) => ` - ${t}`).join('\n')));
          process.exit(Math.min(missedTargets.length, 255));
          return;
        }
      }

      if (fails.length === 0) {
        return;
      }

      if (retryCount >= retryMax) {
        console.error(banner(
            `${retryMax} retries attempted, but still ` +
            `have ${fails.length} failure(s).`));
        return;
      }

      if (retryTargetMax > 0 && fails.length > retryTargetMax) {
        console.error(banner(
            `Number of failures (${fails.length}) exceeds the specified ` +
            `maximum number of test targets to retry(${retryTargetMax}).`));
        return;
      }

      const args =
          stripGrepArgs(process.argv.slice(1).concat(process.execArgv))
              .concat(['--grep', [...fails].map(grepEscape).join('|')]);

      runner.abort();
      console.error(banner(
          `Test run produced ${fails.length} failure(s).\n` +
          `Attempting rerun of failed test targets:\n` +
          fails.map((t) => ' - ' + t).join('\n')));

      const retryResults = spawnSync(process.argv0, args, {
        cwd: initialCurrentWorkingDirectory,
        env: Object.assign({}, process.env, {
          'TEST_RETRY_TARGETS': JSON.stringify(fails),
          'TEST_RETRY_COUNT': `${retryCount + 1}`,
        }),
        stdio: 'inherit',
      });

      process.exit(retryResults.status);
    });
  }
};

/**
 * Standard output block to help call out these interstitial messages amidst
 * large test suite outputs.
 */
function banner(text: string): string {
  return chalk.white.bgRed(
      `*************************\n\n${text}\n\n*************************`);
}

/**
 * When failures happen inside of hooks like "before each" etc, they include the
 * mention of the hook, but since the hook is not a target, we have to strip out
 * those mentions before we can make use of them for `mocha --grep` purposes.
 */
function getFullTitle(test: Mocha.Test): string {
  return test.fullTitle()
      .replace(/^".+" hook for "(.+)"/, '$1')
      .replace(/^(.+) "[^"]+" hook$/, '$1');
}

/**
 * Returns an array of all the expected test targets to retry which do not
 * match any of the actual test targets that were run.
 */
function getMissedTargets(actual: string[], expected: string[]): string[] {
  const missedTargets: string[] = [];
  const matchedTargets = new Set<string>();
  for (const a of actual) {
    const match = expected.find((e) => a.startsWith(e));
    if (match) {
      matchedTargets.add(match);
    }
  }
  for (const e of expected) {
    if (!matchedTargets.has(e)) {
      missedTargets.push(e);
    }
  }
  return missedTargets;
}

/**
 * Why is this not a standard function in JavaScript?  Sigh.  Escapes a string
 * to be a literal string for use in a RegExp.
 */
function grepEscape(s: string): string {
  return s.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Returns an Array parsed from json string, or an empty array if parse fails.
 */
function parseJSONArray(json?: string): string[] {
  try {
    const array = JSON.parse(json);
    if (Array.isArray(array)) {
      return array;
    }
  } catch (e) {
  }
  return [];
}

/**
 * Given an array of args from argv, return an array without any grep/fgrep
 * arguments and their values.
 */
function stripGrepArgs(args: string[]): string[] {
  const filteredArgs = [];
  for (let a = 0; a < args.length; ++a) {
    const arg = args[a];
    if (['--grep', '-g', '--fgrep', '-f'].includes(arg)) {
      ++a;
      continue;
    }
    if (['--grep=', '-g=', 'fgrep=', '-f='].some((p) => arg.startsWith(p))) {
      continue;
    }
    filteredArgs.push(arg);
  }
  return filteredArgs;
}
