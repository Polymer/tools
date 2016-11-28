/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {assert} from 'chai';
import * as http from 'spdy';
import {run as cliRun} from '../cli';
import intercept = require('intercept-stdout');

suite('cli', () => {
  /**
   * Runs the CLI with the given args.
   *
   * Why not do this setup and teardown in the standard  setup() and teardown()
   * methods? Because you don't want to trap stdout at test end, as that would
   * trap mocha's output.
   *
   * TODO(rictic): look into using spawn() to run polyserve in another process
   *     instead. That way we could actually get it started and run it for a
   *     while, hit it with requests, etc.
   *
   * @return A Promise of all STDOUT contents that're written during the
   *     run() function in cli.ts.
   */
  async function runCli(args: string[]) {
    const originalArgv = process.argv;
    process.argv = ['node', 'polyserve'].concat(args);
    let stdout = '';
    let unintercept = intercept((txt) => {
      stdout += txt;
      return '';
    });

    const closeServer = (server: http.Server) =>
        new Promise((resolve, reject) => server.close((e: Error) => {
          e ? reject(e) : resolve();
        }));

    try {
      const serverInfos = await cliRun();
      if (serverInfos) {
        if (serverInfos.kind === 'mainline') {
          await closeServer(serverInfos.server);
        } else {
          await Promise.all(
              serverInfos.servers.map((s) => closeServer(s.server)));
        }
      }
    } finally {
      unintercept();
      process.argv = originalArgv;
    }
    return stdout;
  }

  test('unknown cmd parameter should not throw exception', async() => {
    const stdout = await runCli(['--unknown-parameter']);

    // Assert that we printed something that looks kinda like help text to
    // stdout.
    assert.match(stdout, /A development server for Polymer projects/);
    assert.match(stdout, /--version/);
    assert.match(stdout, /--package-name/);
  });

  test('launches mainline server', async() => {
    await runCli([]);
  });

});
