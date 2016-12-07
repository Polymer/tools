/**
 * @license
 * Copyright (c) 2014 The Polymer Project Authors. All rights reserved.
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

import * as net from 'net';

// We must keep track of ports that we've handed back to the user, as there
// could be a race with two back-to-back requests for a port.
const usedPorts = new Set<number>();

async function checkPort(port: number):
    Promise<boolean> {
      if (usedPorts.has(port)) {
        return false;
      }
      return new Promise<boolean>(function(resolve) {
        const server = net.createServer();
        let hasPort = false;

        // if server is listening, we have the port!
        server.on('listening', function(_err: any) {
          hasPort = true;
          server.close();
        });

        // callback on server close to free up the port before report it can be
        // used
        server.on('close', function(_err: any) {
          if (usedPorts.has(port)) {
            resolve(false);
          }
          if (hasPort) {
            usedPorts.add(port);
          }
          resolve(hasPort);
        });

        // our port is busy, ignore it
        server.on('error', function(_err: any) {
          // docs say the server should close, this doesn't seem to be the case
          // :(
          server.close();
        });

        server.listen(port);
      });
    }

interface PromiseGetter<A, R> {
  (val: A): Promise<R>;
}

async function detectSeries<T>(
    values: T[], promiseGetter: PromiseGetter<T, boolean>): Promise<T> {
  for (const value of values) {
    if (await promiseGetter(value)) {
      return value;
    }
  }
  throw new Error('Couldn\'t find a good value in detectSeries');
}

// Sauce Labs compatible ports
// taken from
// https://docs.saucelabs.com/reference/sauce-connect/#can-i-access-applications-on-localhost-
// - 80, 443, 888: these ports must have root access
// - 5555, 8080: not forwarded on Android
export const SAUCE_PORTS = [
  8081, 8000, 8001, 8003, 8031,  // webbier-looking ports first
  2000, 2001, 2020, 2109, 2222, 2310, 3000, 3001, 3030,  3210, 3333,
  4000, 4001, 4040, 4321, 4502, 4503, 4567, 5000, 5001,  5050, 5432,
  6000, 6001, 6060, 6666, 6543, 7000, 7070, 7774, 7777,  8765, 8777,
  8888, 9000, 9001, 9080, 9090, 9876, 9877, 9999, 49221, 55001
];

export async function findPort(): Promise<number> {
  try {
    const result = await detectSeries(SAUCE_PORTS, checkPort);
    return result;
  } catch (error) {
    throw new Error('no port found!');
  }
};
