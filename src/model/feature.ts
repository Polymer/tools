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

import * as jsdoc from '../javascript/jsdoc';
import {Warning} from '../warning/warning';

import {SourceRange} from './source-range';

export abstract class Feature {
  kinds: Set<string> = new Set();
  identifiers: Set<string> = new Set();

  /** Tracks the source that this feature came from. */
  sourceRange?: SourceRange;

  /**
   * The AST Node, if any, that corresponds to this feature in its containing
   * document.
   */
  astNode?: any;

  /** Warnings that were encountered while processing this feature. */
  warnings: Warning[];

  constructor(sourceRange?: SourceRange, astNode?: any, warnings?: Warning[]) {
    this.sourceRange = sourceRange;
    this.astNode = astNode;
    this.warnings = warnings || [];
  }
}

export abstract class ScannedFeature {
  // TODO(justinfagnani): why is this here and not on Feature?
  description?: string;

  // TODO(rictic): this is the wrong place to put a jsdoc annotation.
  jsdoc?: jsdoc.Annotation;

  /** Tracks the source that this feature came from. */
  sourceRange: SourceRange|undefined;

  /**
   * The AST Node, if any, that corresponds to this feature in its containing
   * document.
   */
  astNode?: any;

  /** Warnings that were encountered while processing this feature. */
  warnings: Warning[];

  constructor(
      sourceRange?: SourceRange, astNode?: any, description?: string,
      jsdoc?: jsdoc.Annotation, warnings?: Warning[]) {
    this.sourceRange = sourceRange;
    this.astNode = astNode;
    this.description = description;
    this.jsdoc = jsdoc;
    this.warnings = warnings || [];
  }
}

export type Privacy = 'public' | 'private' | 'protected';
