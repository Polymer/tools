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

import {DependencyGraph} from './dependency-graph';

export class AnalysisCache {
  /**
   * These are maps from resolved URLs to Promises of various stages of the
   * analysis pipeline.
   */

  parsedDocumentPromises: Map<string, Promise<ParsedDocument<any, any>>>;
  scannedDocumentPromises: Map<string, Promise<ScannedDocument>>;
  analyzedDocumentPromises: Map<string, Promise<Document>>;

  /**
   * This is a map from a resolved url to a promise that will resolve when
   * that document's dependencies have been scanned.
   *
   * We need to keep track of this separate from just the scanned document
   * promise because when one of a document's transitive dependencies changes,
   * and then analysis of the document is requested, we shouldn't need to rescan
   * the document itself, but we do need to rescan its dependencies.
   */
  dependenciesScanned: Map<string, Promise<void>>;

  scannedDocuments: Map<string, ScannedDocument>;
  analyzedDocuments: Map<string, Document>;

  dependencyGraph: DependencyGraph;

  constructor(from?: AnalysisCache, newDependencyGraph?: DependencyGraph) {
    let f: Partial<AnalysisCache> = from || {};
    this.parsedDocumentPromises = shallowCopyMap(f.parsedDocumentPromises);
    this.scannedDocumentPromises = shallowCopyMap(f.scannedDocumentPromises);
    this.analyzedDocumentPromises = shallowCopyMap(f.analyzedDocumentPromises);
    this.dependenciesScanned = shallowCopyMap(f.dependenciesScanned);

    this.scannedDocuments = shallowCopyMap(f.scannedDocuments);
    this.analyzedDocuments = shallowCopyMap(f.analyzedDocuments);
    this.dependencyGraph = newDependencyGraph || new DependencyGraph();
  }

  /**
   * Returns a copy of this cache, with the given document and all of its
   * transitive dependants invalidated.
   *
   * Must be called whenever a document changes.
   */
  invalidatePaths(documentPaths: string[]): AnalysisCache {
    const newCache = new AnalysisCache(
        this, this.dependencyGraph.invalidatePaths(documentPaths));
    for (const path of documentPaths) {
      // Note that we must calculate the dependency graph based on the parent,
      // not the forked newCache.
      const dependants = this.dependencyGraph.getAllDependantsOf(path);
      newCache.parsedDocumentPromises.delete(path);
      newCache.scannedDocumentPromises.delete(path);
      newCache.dependenciesScanned.delete(path);
      newCache.scannedDocuments.delete(path);
      newCache.analyzedDocuments.delete(path);

      // Analyzed documents need to be treated more carefully, because they have
      // relationships with other documents. So first we remove all documents
      // which transitively import the changed document. We also need to mark
      // all of those docs as needing to rescan their dependencies.
      for (const partiallyInvalidatedPath of dependants) {
        newCache.dependenciesScanned.delete(partiallyInvalidatedPath);
        newCache.analyzedDocuments.delete(partiallyInvalidatedPath);
      }

      // Then we clear out the analyzed document promises, which could have
      // in-progress results that don't cohere with the state of the new cache.
      // Only populate the new analyzed promise cache with results that are
      // definite, and not invalidated.
      newCache.analyzedDocumentPromises.clear();
      for (const keyValue of newCache.analyzedDocuments) {
        newCache.analyzedDocumentPromises.set(
            keyValue[0], Promise.resolve(keyValue[1]));
      }
    }

    return newCache;
  }
}

function shallowCopyMap<K, V>(from?: Map<K, V>) {
  if (from) {
    return new Map(from);
  }
  return new Map();
}
