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
import {Warning} from '../warning/warning';

import {FeatureKinds} from './document';
import {Feature} from './feature';

/**
 * Represents something like a Document or a Package. A container of features
 * and warnings that's queryable in a few different ways.
 */
export interface Queryable {
  getByKind<K extends keyof FeatureKinds>(kind: K): Set<FeatureKinds[K]>;
  getByKind(kind: string): Set<Feature>;

  getById<K extends keyof FeatureKinds>(kind: K, identifier: string):
      Set<FeatureKinds[K]>;
  getById(kind: string, identifier: string): Set<Feature>;

  getOnlyAtId<K extends keyof FeatureKinds>(kind: K, identifier: string):
      FeatureKinds[K]|undefined;
  getOnlyAtId(kind: string, identifier: string): Feature|undefined;

  /**
   * Get all transatively reachable features.
   */
  getFeatures(): Set<Feature>;

  /**
   * Get all transatively reachable warnings.
   */
  getWarnings(): Warning[];
}
