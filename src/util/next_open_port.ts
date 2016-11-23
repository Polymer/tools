/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import findPort = require('find-port');

/**
 * If port unspecified/negative, finds an open port on localhost
 * @param {number} port
 * @returns {Promise<number>} Promise of open port
 */
export async function nextOpenPort(port: number): Promise<number> {
  if (port == null || port < 0) {
    port = await new Promise<number>(resolve => {
      // TODO: Switch from `find-port` to `get-port`. `find-port` always
      // resolves a port number even if none are available. The error-event
      // handler in `startWithPort` catches the issue.
      findPort(8080, 8180, (ports: number[]) => {
        resolve(ports[0]);
      });
    });
  }
  return port;
}
