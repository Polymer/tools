import {SourcePosition} from './editor-service';

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
export interface RequestWrapper {
  id: number;
  value: Request;
}
export interface ResponseWrapper {
  id: number;
  value: SettledValue;
}
export type SettledValue = Resolution | Rejection;
export interface Resolution {
  kind: 'resolution';
  resolution: any;
}
export interface Rejection {
  kind: 'rejection';
  rejection: string;
}


export type Request = InitRequest | FileChangedRequest | GetWarningsRequest |
    GetDocumentationRequest | GetDefinitionRequest |
    GetTypeaheadCompletionsRequest | ClearCachesRequest;
export interface InitRequest {
  kind: 'init';
  basedir: string;
}
export interface FileChangedRequest {
  kind: 'fileChanged';
  localPath: string;
  contents?: string;
}
export interface GetWarningsRequest {
  kind: 'getWarningsFor';
  localPath: string;
}
export interface GetDocumentationRequest {
  kind: 'getDocumentationFor';
  localPath: string;
  position: SourcePosition;
}
export interface GetDefinitionRequest {
  kind: 'getDefinitionFor';
  localPath: string;
  position: SourcePosition;
}
export interface GetTypeaheadCompletionsRequest {
  kind: 'getTypeaheadCompletionsFor';
  localPath: string;
  position: SourcePosition;
}
/** Internal, don't use this. May break in the future. */
export interface ClearCachesRequest { kind: '_clearCaches'; }
