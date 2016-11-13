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

import {Document, Import, InlineDocument, ScannedDocument, ScannedImport, ScannedInlineDocument} from './model/model';
import {ParsedDocument} from './parser/document';

export class AnalysisCache {
  parsedDocumentPromises = new Map<string, Promise<ParsedDocument<any, any>>>();
  scannedDocumentPromises = new Map<string, Promise<ScannedDocument>>();
  analyzedDocumentPromises = new Map<string, Promise<Document>>();
  dependenciesScanned = new Map<string, Promise<void>>();

  scannedDocuments = new Map<string, ScannedDocument>();
  analyzedDocuments = new Map<string, Document>();

  /**
   * Returns a copy of this cache, with the given path and all of its transitive
   * dependants invalidated.
   */
  onPathChanged(path: string, dependants: Iterable<string>): AnalysisCache {
    const newCache = this._clone();
    newCache.parsedDocumentPromises.delete(path);
    newCache.scannedDocumentPromises.delete(path);
    newCache.dependenciesScanned.delete(path);
    newCache.scannedDocuments.delete(path);
    newCache.analyzedDocuments.delete(path);

    // Analyzed documents need to be treated more carefully, because they have
    // relationships with other documents. So first we remove all documents
    // which transitively import the changed document. We also need to mark
    // all of those docs as needing to rescan their dependencies.
    for (const invalidatedPath of dependants) {
      newCache.dependenciesScanned.delete(invalidatedPath);
      newCache.analyzedDocuments.delete(invalidatedPath);
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

    return newCache;
  }

  private _clone(): AnalysisCache {
    const newCache = new AnalysisCache();
    this._copyMapInto(
        this.parsedDocumentPromises, newCache.parsedDocumentPromises);
    this._copyMapInto(
        this.scannedDocumentPromises, newCache.scannedDocumentPromises);
    this._copyMapInto(
        this.analyzedDocumentPromises, newCache.analyzedDocumentPromises);
    this._copyMapInto(this.dependenciesScanned, newCache.dependenciesScanned);
    this._copyMapInto(this.scannedDocuments, newCache.scannedDocuments);
    this._copyMapInto(this.analyzedDocuments, newCache.analyzedDocuments);
    return newCache;
  }

  private _copyMapInto<K, V>(from: Map<K, V>, into: Map<K, V>) {
    for (const kv of from) {
      into.set(kv[0], kv[1]);
    }
  }
}

/**
 * Trawl the import graph and return the paths of (transitive) dependants on
 * the given path.
 *
 * This should eventually live somewhere like Document, but we really need
 * something like a Project, which encapsulates all of the known Documents
 * inside a basedir, and which has the same interface as Document. That is the
 * object that the AnalysisCache needs to know the results of calling
 * getImportersOf.
 */
export function getImportersOf(
    path: string,
    documents: Iterable<Document>,
    scannedDocuments: Iterable<ScannedDocument>,
    urlResolver: (url: string) => string): Set<string> {
  const invertedIndex =
      _buildInvertedIndex(documents, scannedDocuments, urlResolver);
  const visited = new Set<string>();
  const toVisit = new Set<string>([path]);
  while (toVisit.size > 0) {
    const path = toVisit.keys().next().value!;
    toVisit.delete(path);
    visited.add(path);
    const importers = invertedIndex.get(path);
    if (!importers) {
      continue;
    }
    for (const importer of importers) {
      if (!visited.has(importer)) {
        toVisit.add(importer);
      }
    }
  }
  return visited;
}

function _buildInvertedIndex(
    docs: Iterable<Document>,
    scannedDocuments: Iterable<ScannedDocument>,
    urlResolver: (url: string) => string): Map<string, Set<string>> {
  const invertedIndex = new Map<string, Set<string>>();
  const docsSeen = new Set<string>();
  for (const doc of docs) {
    docsSeen.add(doc.url);
    _addFeaturesToInvertedIndex(doc, invertedIndex);
  }
  for (const scannedDoc of scannedDocuments) {
    if (docsSeen.has(scannedDoc.url)) {
      continue;
    }
    _addScannedFeaturesToInvertedIndex(scannedDoc, invertedIndex, urlResolver);
  }
  return invertedIndex;
}

function _addFeaturesToInvertedIndex(
    doc: Document, invertedIndex: Map<string, Set<string>>) {
  for (const feature of doc.getFeatures(false)) {
    if (feature.kinds.has('import')) {
      const imported = (feature as Import).url;
      if (!invertedIndex.has(imported)) {
        invertedIndex.set(imported, new Set());
      }
      invertedIndex.get(imported)!.add(doc.url);
    }
    if (feature.kinds.has('inline-document') && feature !== doc) {
      _addFeaturesToInvertedIndex((feature as InlineDocument), invertedIndex);
    }
  }
}

function _addScannedFeaturesToInvertedIndex(
    scannedDoc: ScannedDocument,
    invertedIndex: Map<string, Set<string>>,
    urlResolver: (url: string) => string) {
  for (const feature of scannedDoc.features) {
    if (feature instanceof ScannedImport) {
      const imported = urlResolver(feature.url);
      if (!invertedIndex.has(imported)) {
        invertedIndex.set(imported, new Set());
      }
      invertedIndex.get(imported)!.add(scannedDoc.url);
    } else if (
        feature instanceof ScannedInlineDocument && feature.scannedDocument) {
      _addScannedFeaturesToInvertedIndex(
          feature.scannedDocument, invertedIndex, urlResolver);
    }
  }
}
