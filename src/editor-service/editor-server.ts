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

import * as util from 'util';

import {FSUrlLoader} from '../url-loader/fs-url-loader';
import {PackageUrlResolver} from '../url-loader/package-url-resolver';

import {LocalEditorService} from './local-editor-service';
import {Request, RequestWrapper, ResponseWrapper, SettledValue} from './remote-editor-protocol';


/**
 * Runs out of process and handles decoded Requests.
 */
class EditorServer {
  private _localEditorService: LocalEditorService;
  constructor(basedir: string) {
    this._localEditorService = new LocalEditorService({
      urlLoader: new FSUrlLoader(basedir),
      urlResolver: new PackageUrlResolver()
    });
  }

  async handleMessage(message: Request): Promise<any> {
    switch (message.kind) {
      case 'getWarningsFor':
        return this._localEditorService.getWarningsForFile(message.localPath);
      case 'fileChanged':
        await this._localEditorService.fileChanged(
            message.localPath, message.contents);
        return;
      case 'init':
        throw new Error('Already initialized!');
      case 'getDefinitionFor':
        return this._localEditorService.getDefinitionForFeatureAtPosition(
            message.localPath, message.position);
      case 'getDocumentationFor':
        return this._localEditorService.getDocumentationAtPosition(
            message.localPath, message.position);
      case 'getTypeaheadCompletionsFor':
        return this._localEditorService.getTypeaheadCompletionsAtPosition(
            message.localPath, message.position);
      case 'clearCaches':
        return this._localEditorService._clearCaches();
      default:
        // This assignment makes it a type error if we don't handle all possible
        // values of `message.kind`.
        const never: never = message;
        throw new Error(`Got unknown kind of message: ${util.inspect(never)}`);
    }
  }
}

if (!module.parent) {
  let server: EditorServer;
  process.once('message', (initRequest: RequestWrapper) => {
    if (initRequest.value.kind !== 'init') {
      process.send(<ResponseWrapper>{
        id: initRequest.id,
        value: {
          kind: 'rejection',
          rejection: `Expected first message to be 'init', ` +
              `got ${initRequest.value.kind}`
        }
      });
      return;
    }
    server = new EditorServer(initRequest.value.basedir);

    process.on('message', async(request: RequestWrapper) => {
      const result = await getSettledValue(request.value);
      process.send(<ResponseWrapper>{id: request.id, value: result});
    });
  });

  async function getSettledValue(message: Request): Promise<SettledValue> {
    try {
      const value = await server.handleMessage(message);
      return {kind: 'resolution', resolution: value};
    } catch (e) {
      return {
        kind: 'rejection',
        rejection: e.stack || e.message || e.toString()
      };
    }
  }
}
