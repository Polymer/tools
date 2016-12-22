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

import {Document, FeatureKinds} from './document';
import {Feature} from './feature';
import {Queryable} from './queryable';

/**
 * Represents a queryable interface over all documents in a package/project.
 *
 * Results of queries will include results from all documents in the package, as
 * well as from external dependencies that are transitively imported by
 * documents in the package.
 */
export class Package implements Queryable {
  private _documents: Set<Document>;
  private _toplevelWarnings: Warning[];

  constructor(documents: Iterable<Document>, warnings: Warning[]) {
    const potentialRoots = new Set(documents);
    this._toplevelWarnings = warnings;

    // We trim down the set of documents as a performance optimization. We only
    // need a set of documents such that all other documents we're interested in
    // can be reached from them. That way we'll do less duplicate work when we
    // query over all documents.
    for (const doc of potentialRoots) {
      for (const imprt of doc.getByKind('import')) {
        // When there's cycles we can keep any element of the cycle, so why not
        // this one.
        if (imprt.document !== doc) {
          potentialRoots.delete(imprt.document);
        }
      }
    }
    this._documents = potentialRoots;
  }

  getByKind<K extends keyof FeatureKinds>(kind: K): Set<FeatureKinds[K]>;
  getByKind(kind: string): Set<Feature>;
  getByKind(kind: string): Set<Feature> {
    const result = new Set();
    for (const doc of this._documents) {
      addAll(result, doc.getByKind(kind));
    }
    return result;
  }

  getById<K extends keyof FeatureKinds>(kind: K, identifier: string):
      Set<FeatureKinds[K]>;
  getById(kind: string, identifier: string): Set<Feature>;
  getById(kind: string, identifier: string): Set<Feature> {
    const result = new Set();
    for (const doc of this._documents) {
      addAll(result, doc.getById(kind, identifier));
    }
    return result;
  }

  getOnlyAtId<K extends keyof FeatureKinds>(kind: K, identifier: string):
      FeatureKinds[K]|undefined;
  getOnlyAtId(kind: string, identifier: string): Feature|undefined;
  getOnlyAtId(kind: string, identifier: string): Feature|undefined {
    const results = this.getById(kind, identifier);
    if (results.size > 1) {
      throw new Error(
          `Expected to find at most one ${kind} with id ${identifier} ` +
          `but found ${results.size}.`);
    }
    return results.values().next().value || undefined;
  }

  /**
   * Get all features for all documents in the project or their imports.
   */
  getFeatures(): Set<Feature> {
    const result = new Set();
    for (const doc of this._documents) {
      addAll(result, doc.getFeatures(true));
    }
    return result;
  }

  /**
   * Get all warnings in the project.
   */
  getWarnings(): Warning[] {
    const result = new Set(this._toplevelWarnings);
    for (const doc of this._documents) {
      addAll(result, new Set(doc.getWarnings(true)));
    }
    return Array.from(result);
  }
}

function addAll<T>(set1: Set<T>, set2: Set<T>): Set<T> {
  for (const val of set2) {
    set1.add(val);
  }
  return set1;
}
