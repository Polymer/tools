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

import File = require('vinyl');
import {assert} from 'chai';

export function getFlowingState(stream: NodeJS.ReadableStream): boolean {
  // Cast our streams to <any> so that we can check the flowing state.
  // _readableState is undocumented in the Node.js TypeScript definition,
  // however it is the supported way to assert if a stream is flowing or not.
  // See: https://nodejs.org/api/stream.html#stream_three_states
  // tslint:disable-next-line: no-any
  const privateReadableState = (<any>stream)._readableState;
  return privateReadableState.flowing;
}

/**
 * This method makes it possible to `await` a map of paths to `File` objects
 * emitted by a stream. It returns a Promise that resolves with the map
 * where the paths in the map exclude the optional `root` prefix.
 */
export async function emittedFiles(
    stream: NodeJS.ReadableStream,
    root: string = ''): Promise<Map<string, File>> {
  const files = new Map<string, File>();
  return new Promise<Map<string, File>>(
      (resolve, reject) =>
          stream
              .on('data',
                  (f: File) => files.set(f.path.substring(root.length + 1), f))
              .on('data', () => {/* starts the stream */})
              .on('end', () => resolve(files))
              .on('error', (e: Error) => reject(e)));
}

/**
 * Assert that two strings are equal after collapsing their whitespace.
 */
export const assertEqualIgnoringWhitespace =
    (actual: string, expected: string) =>
        assert.equal(collapseWhitespace(actual), collapseWhitespace(expected));

/**
 * Assert that two string maps are equal, where their values have had their
 * whitespace collapsed.
 */
export const assertMapEqualIgnoringWhitespace =
    (actual: Map<string, string>, expected: Map<string, string>) =>
        assertMapEqual(
            transformMapValues(actual, collapseWhitespace),
            transformMapValues(expected, collapseWhitespace));

/**
 * Collapse all leading whitespace, trailing whitespace, and newlines. Very
 * lossy, but good for loose comparison of HTML, JS, etc.
 */
const collapseWhitespace = (s: string) =>
    s.replace(/^\s+/gm, '').replace(/\s+$/gm, '').replace(/\n/gm, '');

/**
 * Assert that two maps are equal. Note that early versions of chai's deepEqual
 * will always return true, and while later ones will compare correctly, they do
 * not produce very readable output compared to this approach.
 */
const assertMapEqual = <K, V>(actual: Map<K, V>, expected: Map<K, V>) =>
    assert.deepEqual([...actual.entries()], [...expected.entries()]);

/**
 * Return a new map where all values have been transformed with the given
 * function.
 */
const transformMapValues =
    <K, V1, V2>(map: Map<K, V1>, transform: (val: V1) => V2): Map<K, V2> =>
        new Map([...map.entries()].map(
            ([key, val]): [K, V2] => [key, transform(val)]));

/**
 * Calls the given async function and captures all console.log and friends
 * output while until the returned Promise settles.
 *
 * Does not capture plylog, which doesn't seem to be very easy to intercept.
 *
 * TODO(rictic): this function is shared across many of our packages,
 *   put it in a shared package instead.
 */
export async function interceptOutput(captured: () => Promise<void>):
    Promise<string> {
  const originalLog = console.log;
  const originalError = console.error;
  const originalWarn = console.warn;
  const buffer: string[] = [];
  // tslint:disable-next-line:no-any This is genuinely the API.
  const capture = (...args: any[]) => {
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
