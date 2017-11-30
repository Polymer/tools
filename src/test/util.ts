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

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import {Duplex} from 'stream';
import {createConnection, IConnection, TextDocuments} from 'vscode-languageserver/lib/main';
import URI from 'vscode-uri/lib';

import AnalyzerLSPConverter from '../language-server/converter';
import FileSynchronizer from '../language-server/file-synchronizer';

export function createTestConnections(debugging?: boolean) {
  const up = new TestStream('up', debugging);
  const down = new TestStream('down', debugging);
  const serverConnection: IConnection = createConnection(up, down);
  const clientConnection: IConnection = createConnection(down, up);
  serverConnection.listen();
  clientConnection.listen();
  return {serverConnection, clientConnection};
}

export function createFileSynchronizer(baseDir?: string, debugging?: boolean) {
  if (baseDir) {
    baseDir = getTempCopy(baseDir);
  } else {
    baseDir = fs.mkdtempSync(path.join(os.tmpdir(), 'editor-service-tests'));
  }

  const {serverConnection, clientConnection} = createTestConnections(debugging);
  const textDocuments = new TextDocuments();
  textDocuments.listen(serverConnection);
  const converter = new AnalyzerLSPConverter(URI.file(baseDir));
  const synchronizer =
      new FileSynchronizer(serverConnection, textDocuments, baseDir, converter);
  return {synchronizer, serverConnection, clientConnection, baseDir, converter};
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

export function getTempCopy(fromDir: string) {
  const toDir = fs.mkdtempSync(path.join(os.tmpdir(), path.basename(fromDir)));
  copyDir(fromDir, toDir);
  return toDir;
}

export function copyDir(fromDir: string, toDir: string) {
  for (const inner of fs.readdirSync(fromDir)) {
    const fromInner = path.join(fromDir, inner);
    const toInner = path.join(toDir, inner);
    const stat = fs.statSync(fromInner);
    if (stat.isDirectory()) {
      fs.mkdirSync(toInner);
      copyDir(fromInner, toInner);
    } else {
      fs.writeFileSync(toInner, fs.readFileSync(fromInner));
    }
  }
}
