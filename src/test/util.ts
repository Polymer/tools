/**
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

import {Duplex} from 'stream';
import {createConnection, IConnection} from 'vscode-languageserver/lib/main';

export function createTestConnections(debugging?: boolean) {
  const up = new TestStream('up', debugging);
  const down = new TestStream('down', debugging);
  const serverConnection: IConnection = createConnection(up, down);
  const clientConnection: IConnection = createConnection(down, up);
  serverConnection.listen();
  clientConnection.listen();
  return {serverConnection, clientConnection};
}

/** Duplex stream that optionally logs content. */
class TestStream extends Duplex {
  constructor(public name: string, private debugging?: boolean) {
    super();
  }

  _write(chunk: string, _encoding: string, done: () => void) {
    if (this.debugging) {
      console.log(`this.name writes: ${chunk}`);
    }
    this.emit('data', chunk);
    done();
  }

  _read(_size: number) {
  }
}
