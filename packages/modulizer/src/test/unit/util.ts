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

/**
 * Takes an AIIFE and captures its console.log (etc) output as a string.
 *
 * More specifically, this function immediately begins capturing the output of
 * console.log and friends. It then calls `captured`. When it resolves, this
 * method stops capturing and returns the output as a string.
 *
 * Does not capture plylog, or direct writes to process.stdout and friends,
 * which don't seem to be very easy to intercept.
 */
export async function interceptOutput(captured: () => Promise<void>):
    Promise<string> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const buffer: string[] = [];
  const capture = (...args: Array<{}>) => {
    buffer.push(args.join(' '));
  };
  console.log = capture;
  console.error = capture;
  console.warn = capture;
  const restoreAndGetOutput = () => {
    console.log = originalLog;
    console.error = originalError;
    console.warn = originalWarn;
    return buffer.join('\n');
  };
  try {
    await captured();
  } catch (err) {
    const output = restoreAndGetOutput();
    console.error(output);
    throw err;
  }

  return restoreAndGetOutput();
}
