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

import {Document, ScannedDocument} from '../model/model';
import {ParsedDocument} from '../parser/document';
import {PromiseGroup} from '../util/promise-group';

import {AsyncWorkCache} from './async-work-cache';
import {DependencyGraph} from './dependency-graph';

export class AnalysisCache {
  /**
   * These are maps from resolved URLs to Promises of various stages of the
   * analysis pipeline.
   */

  parsedDocumentPromises: AsyncWorkCache<string, ParsedDocument<any, any>>;
  scannedDocumentPromises: AsyncWorkCache<string, ScannedDocument>;
  analyzedDocumentPromises: AsyncWorkCache<string, Document>;

  /**
   * A set of resolved urls whose dependencies have been scanned.
   *
   * A url's presence means that you can skip scanning its dependencies. It's
   * not an AsyncWorkCache because scanning the same dependency cache twice is
   * idempotent, and subject to deadlocks with circular dependency graphs.
   */
  dependenciesScannedOf: Map<string, PromiseGroup<ScannedDocument>>;

  /**
   * TODO(rictic): These synchronous caches need to be kept in sync with their
   *     async work cache analogues above.
   */
  scannedDocuments: Map<string, ScannedDocument>;
  analyzedDocuments: Map<string, Document>;

  dependencyGraph: DependencyGraph;

  /**
   * @param from Another AnalysisCache to copy the caches from. The new
   *   AnalysisCache will have an independent copy of everything but from's
   *   dependency graph, which is passed in separately.
   * @param newDependencyGraph If given, use this dependency graph. We pass
   *   this in like this purely as an optimization. See `invalidatePaths`.
   */
  constructor(from?: AnalysisCache, newDependencyGraph?: DependencyGraph) {
    const f: Partial<AnalysisCache> = from || {};
    this.parsedDocumentPromises = new AsyncWorkCache(f.parsedDocumentPromises);
    this.scannedDocumentPromises =
        new AsyncWorkCache(f.scannedDocumentPromises);
    this.analyzedDocumentPromises =
        new AsyncWorkCache(f.analyzedDocumentPromises);
    this.dependenciesScannedOf = new Map(f.dependenciesScannedOf!);

    this.scannedDocuments = new Map(f.scannedDocuments!);
    this.analyzedDocuments = new Map(f.analyzedDocuments!);
    this.dependencyGraph = newDependencyGraph || new DependencyGraph();
  }

  /**
   * Returns a copy of this cache, with the given document and all of its
   * transitive dependants invalidated.
   *
   * Must be called whenever a document changes.
   */
  invalidate(documentPaths: string[]): AnalysisCache {
    const newCache = new AnalysisCache(
        this, this.dependencyGraph.invalidatePaths(documentPaths));
    for (const path of documentPaths) {
      // Note that we must calculate the dependency graph based on the parent,
      // not the forked newCache.
      const dependants = this.dependencyGraph.getAllDependantsOf(path);
      newCache.parsedDocumentPromises.delete(path);
      newCache.scannedDocumentPromises.delete(path);
      newCache.dependenciesScannedOf.delete(path);
      newCache.scannedDocuments.delete(path);
      newCache.analyzedDocuments.delete(path);

      // Analyzed documents need to be treated more carefully, because they have
      // relationships with other documents. So first we remove all documents
      // which transitively import the changed document. We also need to mark
      // all of those docs as needing to rescan their dependencies.
      for (const partiallyInvalidatedPath of dependants) {
        // TODO(justinfagnani): work into comment abbove:
        // Scanning now (or already did) depends on transitive relationships
        // because the scanned promise represents that all transitive
        // dependencies
        // are scanned as well. So when we invalidate a url we need to
        // invalidate
        // the scanned state of all transitive dependants.
        // This could be changed if we separate local scanning from "linking"
        newCache.scannedDocumentPromises.delete(partiallyInvalidatedPath);
        newCache.scannedDocuments.delete(partiallyInvalidatedPath);
        newCache.dependenciesScannedOf.delete(partiallyInvalidatedPath);
        newCache.analyzedDocuments.delete(partiallyInvalidatedPath);
      }

      // Then we clear out the analyzed document promises, which could have
      // in-progress results that don't cohere with the state of the new cache.
      // Only populate the new analyzed promise cache with results that are
      // definite, and not invalidated.
      newCache.analyzedDocumentPromises.clear();
      for (const keyValue of newCache.analyzedDocuments) {
        newCache.analyzedDocumentPromises.set(keyValue[0], keyValue[1]);
      }
    }

    return newCache;
  }
}
