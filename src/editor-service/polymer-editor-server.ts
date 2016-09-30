#!/usr/bin/env node
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

/**
 * This file is a binary not a library, and should be run via
 * `node polymer-editor-server.js` or `child_process.fork`
 *
 * Communication with this server is done via the Remote Editor Protocol via
 * stdin and stdout, as well as the node process.on('message') IPC process.
 *
 * See 'remote-editor-protocol.ts' for details on the communication protocol.
 */

import * as split from 'split';
import * as util from 'util';

import {FSUrlLoader} from '../url-loader/fs-url-loader';
import {PackageUrlResolver} from '../url-loader/package-url-resolver';

import {LocalEditorService} from './local-editor-service';
import {Request, RequestWrapper, ResponseWrapper, SettledValue} from './remote-editor-protocol';

/**
 * Handles decoded Requests, dispatching them to a local editor service.
 */
class EditorServer {
  private _localEditorService: LocalEditorService;

  async handleMessage(message: Request): Promise<any> {
    if (message.kind === 'init') {
      if (this._localEditorService) {
        throw new Error('Already initialized!');
      }
      this._localEditorService = new LocalEditorService({
        urlLoader: new FSUrlLoader(message.basedir),
        urlResolver: new PackageUrlResolver()
      });
      return;
    }
    const localEditorService = this._localEditorService;
    if (!localEditorService) {
      throw new Error(
          `Must send an 'init' message before any others. ` +
          `Received '${message.kind}' message before 'init'.`);
    }
    switch (message.kind) {
      case 'getWarningsFor':
        return localEditorService.getWarningsForFile(message.localPath);
      case 'fileChanged':
        await localEditorService.fileChanged(
            message.localPath, message.contents);
        return;
      case 'getDefinitionFor':
        return localEditorService.getDefinitionForFeatureAtPosition(
            message.localPath, message.position);
      case 'getDocumentationFor':
        return localEditorService.getDocumentationAtPosition(
            message.localPath, message.position);
      case 'getTypeaheadCompletionsFor':
        return localEditorService.getTypeaheadCompletionsAtPosition(
            message.localPath, message.position);
      case '_clearCaches':
        return localEditorService._clearCaches();
      default:
        const never: never = message;
        throw new Error(`Got unknown kind of message: ${util.inspect(never)}`);
    }
  }
}


const server: EditorServer = new EditorServer();

// stdin/stdout interface
process.stdin.setEncoding('utf8');
process.stdin.resume();
process.stdin.pipe(split()).on('data', async function(line: string) {
  if (line.trim() === '') {
    return;
  }
  let result: SettledValue;
  let id: number|undefined = undefined;
  try {
    const request: RequestWrapper = JSON.parse(line);
    id = request.id;
    result = await getSettledValue(request.value);
  } catch (e) {
    if (id == null) {
      id = -1;
    }
    result = {
      kind: 'rejection',
      rejection: e.message || e.stack || e.toString()
    };
  }

  /** Have a respond function for type checking of ResponseWrapper */
  function respond(response: ResponseWrapper) {
    process.stdout.write(JSON.stringify(response) + '\n');
  }
  respond({id, value: result});
});

// node child_process.fork() IPC interface
process.on('message', async function(request: RequestWrapper) {
  const result = await getSettledValue(request.value);
  /** Have a respond function for type checking of ResponseWrapper */
  function respond(response: ResponseWrapper) {
    process.send!(response);
  }
  respond({id: request.id, value: result});
});


/**
 * Calls into the server and converts its responses into SettledValues.
 */
async function getSettledValue(request: Request): Promise<SettledValue> {
  try {
    const value = await server.handleMessage(request);
    return {kind: 'resolution', resolution: value};
  } catch (e) {
    return {kind: 'rejection', rejection: e.message || e.stack || e.toString()};
  }
}