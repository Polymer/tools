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
import {SourceRange} from '../model/model';

import {Privacy, ScannedFeature} from './model';

export interface ScannedProperty extends ScannedFeature {
  name: string;
  type?: string;
  privacy: Privacy;
  'default'?: string;
  readOnly?: boolean;
  changeEvent?: string;
}

export interface Property {
  name: string;
  type?: string;
  description?: string;
  jsdoc?: jsdoc.Annotation;
  privacy: Privacy;
  'default'?: string;
  readOnly?: boolean;
  sourceRange?: SourceRange;
  inheritedFrom?: string;
  changeEvent?: string;
}
