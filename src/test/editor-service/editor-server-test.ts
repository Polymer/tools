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
import * as child_process from 'child_process';
import * as path from 'path';
import * as split from 'split';
import * as util from 'util';

import {invertPromise} from '../test-utils';

const pathToServer =
    path.join(__dirname, '../../editor-service/polymer-editor-server.js');

suite('RemoteEditorService', () => {
  /**
   * These are the tests. We run these tests using a few different ways of
   * communicating with the server.
   */
  function editorServiceInterfaceTests(
      sendRequest: (request: any) => Promise<void>,
      getNextResponse: (expectedId: number) => Promise<any>) {
    const initMessage = {
      kind: 'init',
      basedir: `${path.join(__dirname, 'static')}`
    };
    const getWarningsMessage = {
      kind: 'getWarningsFor',
      localPath: 'malformed.html'
    };


    test('can create and initialize', async() => {
      await sendRequest({id: 0, value: initMessage});
      const response = await getNextResponse(0);
      assert.deepEqual(response, undefined);
    });
    test('initializing twice is an error', async() => {
      await sendRequest({id: 0, value: initMessage});
      await getNextResponse(0);
      await sendRequest({id: 1, value: initMessage});
      const errorMessage = await invertPromise(getNextResponse(1));
      assert.equal(errorMessage, 'Already initialized!');
    });
    test('the first request must be initialization', async() => {
      await sendRequest({id: 0, value: getWarningsMessage});
      const errorMessage = await invertPromise(getNextResponse(0));
      assert.equal(
          errorMessage,
          `Must send an 'init' message before any others. Received ` +
              `'getWarningsFor' message before 'init'.`);
    });
    const testName = 'can perform editor service functions once initialized';
    test(testName, async() => {
      await sendRequest({id: 0, value: initMessage});
      await getNextResponse(0);
      await sendRequest({id: 1, value: getWarningsMessage});
      const warnings = await getNextResponse(1);
      assert.deepEqual(warnings, [{
                         code: 'parse-error',
                         message: 'Unexpected token <',
                         severity: 0,
                         sourceRange: {
                           file: 'malformed.html',
                           start: {line: 266, column: 0},
                           end: {line: 266, column: 0}
                         }
                       }]);
    });
  }

  suite(
      'from node with child_process.fork() and process.send() for IPC', () => {

        let child: child_process.ChildProcess;

        setup(() => {
          child = child_process.fork(pathToServer);
        });

        teardown(() => {
          child.kill();
        });

        async function sendRequest(request: any) {
          child.send(request);
        };

        async function getNextResponse(expectedId: number) {
          const message = await new Promise<any>((resolve) => {
            child.once('message', function(msg: any) {
              resolve(msg);
            });
          });
          assert.equal(message.id, expectedId);

          if (message.value.kind === 'resolution') {
            return message.value.resolution;
          }
          if (message.value.kind === 'rejection') {
            throw message.value.rejection;
          }
          throw new Error(
              `Response with unexpected kind: ${util.inspect(message.value)}`);
        };

        editorServiceInterfaceTests(sendRequest, getNextResponse);
      });

  suite('from the command line with stdin and stdout', () => {
    let child: child_process.ChildProcess;
    let lines: NodeJS.ReadableStream;

    setup(() => {
      child = child_process.spawn(
          'node', [pathToServer], {stdio: ['pipe', 'pipe', 'pipe']});
      child.stdout.setEncoding('utf8');
      child.stdout.resume();
      lines = child.stdout.pipe(split());
    });

    teardown(() => {
      child.kill();
    });

    async function sendRequest(message: any) {
      return new Promise<void>((resolve, reject) => {
        child.stdin.write(JSON.stringify(message) + '\n', (err: any) => {
          err ? reject(err) : resolve();
        });
      });
    };

    async function getNextResponse(expectedId: number) {
      const line =
          await new Promise<string>(resolve => lines.once('data', resolve));
      const message = JSON.parse(line);
      assert.equal(message.id, expectedId);
      if (message.value.kind === 'resolution') {
        return message.value.resolution;
      } else if (message.value.kind === 'rejection') {
        throw message.value.rejection;
      }
      throw new Error(
          `Response with unexpected kind: ${util.inspect(message.value)}`);
    }

    editorServiceInterfaceTests(sendRequest, getNextResponse);
  });
});
