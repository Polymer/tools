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

import {createWriteStream, WriteStream} from 'fs';
import {IConnection} from 'vscode-languageserver/lib/main';

import Settings from './settings';

export class Logger {
  private readonly connection: IConnection;
  private logFile: WriteStream|undefined = undefined;
  private readonly logFileFromFlag: WriteStream|undefined;
  private settings: Settings|undefined;
  private queue: string[] = [];
  constructor(options:
                  {connection: IConnection, logToFileFlag: string|undefined}) {
    this.connection = options.connection;
    if (options.logToFileFlag !== undefined) {
      this.logFileFromFlag = undefined;
      try {
        this.logFileFromFlag =
            createWriteStream(options.logToFileFlag, {flags: 'a'});
      } catch {
        // don't care
      }
    }
  }

  async hookupSettings(settings: Settings) {
    settings.changeStream.listen(({older, newer}) => {
      if (older.logToFile !== newer.logToFile) {
        if (this.logFile) {
          this.logFile.end();
          this.logFile = undefined;
        }
        if (newer.logToFile) {
          try {
            this.logFile = createWriteStream(newer.logToFile, {flags: 'a'});
          } catch {
            this.logFile = undefined;
          }
        }
      }
    });

    // Wait for settings to stabilize. We might be getting an update
    // from the client, but we might not, it is optional.
    await settings.ready;

    // Start logging as the settings request.
    this.settings = settings;

    // Write out all queued messages, then empty the queue.
    for (const queuedMessage of this.queue) {
      this.log(queuedMessage);
    }
    this.queue.length = 0;
  }

  dispose() {
    if (this.logFile) {
      this.logFile.end();
      this.logFile = undefined;
    }
  }

  log(message: string) {
    if (this.settings) {
      if (this.settings.logToClient) {
        this.connection.console.log(message);
      }
      if (this.logFile !== undefined) {
        try {
          this.logFile.write(message + '\n');
        } catch {
          // don't care
        }
      }
      if (this.logFileFromFlag !== undefined) {
        try {
          this.logFileFromFlag.write(message + '\n');
        } catch {
          // don't care
        }
      }
    } else {
      this.queue.push(message);
    }
  }
}
