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

export function getFlowingState(stream: NodeJS.ReadableStream): boolean {
  // Cast our streams to <any> so that we can check the flowing state.
  // _readableState is undocumented in the Node.js TypeScript definition,
  // however it is the supported way to assert if a stream is flowing or not.
  // See: https://nodejs.org/api/stream.html#stream_three_states
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
