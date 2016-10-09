/**
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
import {Warning} from '../warning/warning';

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

export interface SourcePosition {
  /** Line number in file, starting from 0. */
  line: number;
  /** Column number in file, starting from 0. */
  column: number;
}

// Important note: all arguments to, and results returned from editor service
//     methods MUST be serializable as JSON, as the editor service may be
//     running out of process and communicating with JSON strings.
//
//     Fortunately, editor-service_test will test that the results are JSON
//     serializable.
export abstract class EditorService {
  /**
   * Notify the editor service that the given file has changed, and give the
   * updated contents that should be used. If this method is not called, then
   * the editor service will assume that files do not change and their contents
   * will be cached.
   */
  abstract async fileChanged(localPath: string, contents: string):
      Promise<void>;

  /**
   * Gives the documentation, as markdown encoded text, for the feature at
   * the given position in the given file.
   */
  abstract async getDocumentationAtPosition(
      localPath: string, position: SourcePosition): Promise<string|undefined>;

  /**
   * Gives the location for the definition for a feature. For example, for a
   * v1 custom element, it will find its class.
   */
  abstract async getDefinitionForFeatureAtPosition(
      localPath: string, position: SourcePosition): Promise<SourceRange>;

  /**
   * Assuming that the user is typing at the given location, what suggestions
   * should we give for autocomplete?
   */
  abstract async getTypeaheadCompletionsAtPosition(
      localPath: string,
      position: SourcePosition): Promise<TypeaheadCompletion|undefined>;

  /**
   * Gives all warnings, errors, info notices, etc for the given file.
   */
  abstract async getWarningsForFile(localPath: string): Promise<Warning[]>;

  /**
   * Internal method, do not call. May be removed in a future release.
   *
   * Instructs the editor service to clear out all caches. Use very sparingly,
   * as this will dramatically reduce performance of the next request as all
   * relevant source must be re-read, parsed, scanned, and resolved.
   *
   * Useful for tests.
   */
  abstract async _clearCaches(): Promise<void>;
}
