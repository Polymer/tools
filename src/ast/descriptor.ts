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
import {SourceRange} from './source-range';

export type LiteralValue =
    string | number | boolean | RegExp | undefined | LiteralArray | LiteralObj;
export interface LiteralArray extends Array<LiteralValue> {}
export interface LiteralObj { [key: string]: LiteralValue; }

export interface ScannedFeature {
  description?: string;

  // TODO(rictic): this is the wrong place to put a jsdoc annotation.
  jsdoc?: jsdoc.Annotation;

  /** Tracks the source that this feature came from. */
  sourceRange: SourceRange;
}
