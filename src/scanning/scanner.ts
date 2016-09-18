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

import {Analyzer} from '../analyzer';
import {ScannedFeature} from '../model/model';
import {ParsedDocument} from '../parser/document';

export interface Scanner<D extends ParsedDocument<A, V>, A, V> {
  scan(document: D, visit: (visitor: V) => Promise<void>):
      Promise<ScannedFeature[]>;
}

export interface ScannerConstructor {
  new (analyzer: Analyzer): Scanner<any, any, any>;
}
