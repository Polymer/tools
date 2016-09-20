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

import * as child_process from 'child_process';
import * as path from 'path';
import * as util from 'util';

import {SourceRange} from '../model/model';

import {EditorService, SourcePosition, TypeaheadCompletion, Warning} from './editor-service';

/**
 * The remote editor service protocol is request/response based.
 * Requests and responses are JSON serialized objects.
 *
 * Every request must have a unique identifier. For every request there
 * will be at most one response with the corresponding identifier. Responses
 * may come in any order.
 *
 * Responses are modeled on settled Promise values. A response is either
 * successful and resolved or unsuccessful and rejected.
 *
 * The types of requests and responses obey the EditorService interface, with
 * some modification of method calls for the JSON format. See the Request
 * type for more information.
 */
interface RequestWrapper {
  id: number;
  value: Request;
}
interface ResponseWrapper {
  id: number;
  value: SettledValue;
}
type SettledValue = Resolution|Rejection;
interface Resolution {
  kind: 'resolution';
  resolution: any;
}
interface Rejection {
  kind: 'rejection';
  rejection: string;
}


type Request =
    InitRequest|FileChangedRequest|GetWarningsRequest|GetDocumentationRequest|
    GetDefinitionRequest|GetTypeaheadCompletionsRequest|ClearCachesRequest;
interface InitRequest {
  kind: 'init';
  basedir: string;
}
interface FileChangedRequest {
  kind: 'fileChanged';
  localPath: string;
  contents?: string;
}
interface GetWarningsRequest {
  kind: 'getWarningsFor';
  localPath: string;
}
interface GetDocumentationRequest {
  kind: 'getDocumentationFor';
  localPath: string;
  position: SourcePosition;
}
interface GetDefinitionRequest {
  kind: 'getDefinitionFor';
  localPath: string;
  position: SourcePosition;
}
interface GetTypeaheadCompletionsRequest {
  kind: 'getTypeaheadCompletionsFor';
  localPath: string;
  position: SourcePosition;
}
interface ClearCachesRequest {
  kind: 'clearCaches';
}

/**
 * Runs the editor server in a new node process and exposes a promise based
 * request API for communicating with it.
 */
class EditorServerChannel {
  private _child: child_process.ChildProcess;
  private _idCounter = 0;
  private _outstandingRequests = new Map<number, Deferred<any>>();
  constructor() {
    const serverJsFile = path.join(__dirname, 'editor-server.js');
    this._child = child_process.fork(serverJsFile, [], {});
    this._child.addListener(
        'message', (m: ResponseWrapper) => this._handleResponse(m));
  }

  async request(req: Request): Promise<any> {
    const id = this._idCounter++;
    const deferred = new Deferred<any>();
    this._outstandingRequests.set(id, deferred);
    await this._sendRequest(id, req);
    return deferred.promise;
  }

  private _handleResponse(response: ResponseWrapper): void {
    const deferred = this._outstandingRequests.get(response.id);
    if (!deferred) {
      return;
    }
    switch (response.value.kind) {
      case 'resolution':
        return deferred.resolve(response.value.resolution);
      case 'rejection':
        return deferred.reject(response.value.rejection);
      default:
        const never: never = response.value;
        throw new Error(`Got unknown kind of response: ${util.inspect(never)}`);
    }
  }

  private async _sendRequest(id: number, value: Request): Promise<void> {
    const request: RequestWrapper = {id, value: value};
    await new Promise((resolve, reject) => {
      (<any>this._child.send)(
          request, (err: any) => err ? reject(err) : resolve());
    });
  }

  dispose(): void {
    this._child.kill();
  }
}

/**
 * Runs in-process and communicates to the editor server, which
 * runs in a child process. Exposes the same interface as the
 * LocalEditorService.
 */
export class RemoteEditorService extends EditorService {
  private _channel = new EditorServerChannel();
  constructor(basedir: string) {
    super();
    this._channel.request({kind: 'init', basedir});
  }

  async getWarningsForFile(localPath: string): Promise<Warning[]> {
    return this._channel.request({kind: 'getWarningsFor', localPath});
  }

  async fileChanged(localPath: string, contents?: string): Promise<void> {
    return this._channel.request({kind: 'fileChanged', localPath, contents});
  }

  async getDocumentationAtPosition(localPath: string, position: SourcePosition):
      Promise<string|undefined> {
    return this._channel.request(
        {kind: 'getDocumentationFor', localPath, position});
  }

  async getDefinitionForFeatureAtPosition(
      localPath: string, position: SourcePosition): Promise<SourceRange> {
    return this._channel.request(
        {kind: 'getDefinitionFor', localPath, position});
  }

  async getTypeaheadCompletionsAtPosition(
      localPath: string,
      position: SourcePosition): Promise<TypeaheadCompletion|undefined> {
    return this._channel.request(
        {kind: 'getTypeaheadCompletionsFor', localPath, position});
  }

  async _clearCaches(): Promise<void> {
    return this._channel.request({kind: 'clearCaches'});
  }

  dispose(): void {
    this._channel.dispose();
  }
}

class Deferred<V> {
  promise: Promise<V>;
  resolve: (resp: V) => void;
  reject: (err: any) => void;

  constructor() {
    this.promise = new Promise((res, rej) => {
      this.resolve = res;
      this.reject = rej;
    });
  }
}
