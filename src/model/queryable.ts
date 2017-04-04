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

import {FeatureKinds} from './document';
import {Feature} from './feature';
import {Warning} from './warning';

export interface BaseQueryOptions {
  /**
   * If true then results will include features from outside the package, e.g.
   * from files in bower_components or node_modules directories.
   *
   * Note that even with this option you'll only get results from external files
   * that are referenced from within the package.
   */
  externalPackages?: boolean;

  /**
   * Do not include any features that are only reachable via paths that include
   * lazy import edges.
   */
  noLazyImports?: boolean;
}

export type QueryOptions = BaseQueryOptions & object;

/**
 * Represents something like a Document or a Package. A container of features
 * and warnings that's queryable in a few different ways.
 */
export interface Queryable {
  getByKind<K extends keyof FeatureKinds>(kind: K, options?: QueryOptions):
      Set<FeatureKinds[K]>;
  getByKind(kind: string, options?: QueryOptions): Set<Feature>;

  getById<K extends keyof FeatureKinds>(
      kind: K, identifier: string,
      options?: QueryOptions): Set<FeatureKinds[K]>;
  getById(kind: string, identifier: string, options?: QueryOptions):
      Set<Feature>;

  getOnlyAtId<K extends keyof FeatureKinds>(
      kind: K, identifier: string,
      options?: QueryOptions): FeatureKinds[K]|undefined;
  getOnlyAtId(kind: string, identifier: string, options?: QueryOptions): Feature
      |undefined;

  getFeatures(options?: QueryOptions): Set<Feature>;

  getWarnings(options?: QueryOptions): Warning[];
}
