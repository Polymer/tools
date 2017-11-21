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

import {Document, ScannedDocument, Warning} from '../model/model';
import {ResolvedUrl} from '../model/url';
import {ParsedDocument} from '../parser/document';

import {AsyncWorkCache} from './async-work-cache';
import {DependencyGraph} from './dependency-graph';

export class AnalysisCache {
  /**
   * These are maps from resolved URLs to Promises of various stages of the
   * analysis pipeline.
   */
  readonly parsedDocumentPromises: AsyncWorkCache<ResolvedUrl, ParsedDocument>;
  readonly scannedDocumentPromises:
      AsyncWorkCache<ResolvedUrl, ScannedDocument>;
  readonly dependenciesScannedPromises:
      AsyncWorkCache<ResolvedUrl, ScannedDocument>;
  readonly analyzedDocumentPromises: AsyncWorkCache<ResolvedUrl, Document>;

  /**
   * TODO(rictic): These synchronous caches need to be kept in sync with their
   *     async work cache analogues above.
   */
  readonly scannedDocuments: Map<ResolvedUrl, ScannedDocument>;
  readonly analyzedDocuments: Map<ResolvedUrl, Document>;
  readonly failedDocuments: Map<ResolvedUrl, Warning>;

  readonly dependencyGraph: DependencyGraph;

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
    this.dependenciesScannedPromises =
        new AsyncWorkCache(f.dependenciesScannedPromises);

    this.failedDocuments = new Map(f.failedDocuments!);
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
  invalidate(documentPaths: ResolvedUrl[]): AnalysisCache {
    // TODO(rictic): how much of this work can we short circuit in the case
    //     none of these paths are in any of the caches? e.g. when someone calls
    //     filesChanged() for the same files twice without ever calling analyze?
    //     Could end up saving some work in the editor case.
    //     On the other hand, copying a half dozen maps with maybe 200 entries
    //     each should be pretty cheap, maybe not worth the effort.
    const newCache = new AnalysisCache(
        this, this.dependencyGraph.invalidatePaths(documentPaths));
    for (const path of documentPaths) {
      // Note that we must calculate the dependency graph based on the parent,
      // not the forked newCache.
      const dependants = this.dependencyGraph.getAllDependantsOf(path);
      newCache.parsedDocumentPromises.delete(path);
      newCache.scannedDocumentPromises.delete(path);
      newCache.dependenciesScannedPromises.delete(path);
      newCache.scannedDocuments.delete(path);
      newCache.analyzedDocuments.delete(path);
      newCache.failedDocuments.delete(path);

      // Analyzed documents need to be treated more carefully, because they have
      // relationships with other documents. So first we remove all documents
      // which transitively import the changed document. We also need to mark
      // all of those docs as needing to rescan their dependencies.
      for (const partiallyInvalidatedPath of dependants) {
        newCache.dependenciesScannedPromises.delete(partiallyInvalidatedPath);
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

  toString() {
    let result = `<AnalysisCache`;
    if (this.scannedDocuments.size > 0) {
      result += `
  scannedDocuments:
    ${Array.from(this.scannedDocuments.keys()).join('\n    ')}`;
    }
    if (this.analyzedDocuments.size > 0) {
      result += `
  analyzedDocuments:
    ${Array.from(this.analyzedDocuments.keys()).join('\n    ')}`;
    }
    if (this.failedDocuments.size > 0) {
      result += `
  failedDocuments:
    ${Array.from(this.failedDocuments.keys()).join('\n    ')}`;
    }
    result += '>';
    return result;
  }
}
