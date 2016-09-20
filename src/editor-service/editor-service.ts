/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import {SourceRange} from '../model/model';

export type TypeaheadCompletion = ElementCompletion | AttributesCompletion;
export interface ElementCompletion {
  kind: 'element-tags';
  elements: {tagname: string, description: string, expandTo?: string}[];
}
export interface AttributesCompletion {
  kind: 'attributes';
  attributes: AttributeCompletion[];
}

export interface AttributeCompletion {
  name: string;
  description: string;
  type: string|undefined;
  sortKey: string;
  inheritedFrom?: string;
}

export interface Warning {
  message: string;
  sourceRange: SourceRange;
  severity: Severity;
  code: string;
}

export enum Severity {
  ERROR,
  WARNING,
  INFO
}

export interface SourcePosition {
  /** Line number in file, starting from 0. */
  line: number;
  /** Column number in file, starting from 0. */
  column: number;
}

export class WarningCarryingException extends Error {
  warning: Warning;
  constructor(warning: Warning) {
    super(warning.message);
    this.warning = warning;
  }
}

// Important note: all arguments to, and results returned from editor service
//     methods MUST be serializable as JSON, as the editor service may be
//     running out of process and communicating with JSON strings.
//
//     Fortunately, editor-service_test will test that the results are JSON
//     serializable.
export abstract class EditorService {
  abstract async fileChanged(localPath: string, contents?: string):
      Promise<void>;

  abstract async getDocumentationAtPosition(
      localPath: string, position: SourcePosition): Promise<string|undefined>;

  abstract async getDefinitionForFeatureAtPosition(
      localPath: string, position: SourcePosition): Promise<SourceRange>;

  abstract async getTypeaheadCompletionsAtPosition(
      localPath: string,
      position: SourcePosition): Promise<TypeaheadCompletion|undefined>;

  abstract async getWarningsForFile(localPath: string): Promise<Warning[]>;

  abstract async clearCaches(): Promise<void>;
}



//
