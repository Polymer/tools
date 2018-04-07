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

import {SourceRange} from '../analysis-format/analysis-format';
import {AnalysisContext} from '../core/analysis-context';
import {addAll} from '../core/utils';
import {PackageRelativeUrl} from '../index';

import {Document} from './document';
import {Feature} from './feature';
import {ImmutableMap, ImmutableSet} from './immutable';
import {AnalysisQuery as Query, AnalysisQueryWithKind as QueryWithKind, DocumentQuery, FeatureKind, FeatureKindMap, Queryable} from './queryable';
import {isPositionInsideRange} from './source-range';
import {ResolvedUrl} from './url';
import {Warning} from './warning';


/**
 * Represents the result of a computation that may fail.
 *
 * This lets us represent errors in a type-safe way, as well as
 * in a way that makes it clear to the caller that the computation
 * may fail.
 */
export type Result<T, E> = {
  successful: true,
  value: T,
}|{
  successful: false,
  error: E,
};

// A regexp that matches paths to external code.
// TODO(rictic): Make this part of the URL Resolver.
//     https://github.com/Polymer/polymer-analyzer/issues/803
// Note that we will match any directory name prefixed by `bower_components` or
// `node_modules` in order to ignore `polymer install`'s variants, which look
// like bower_components-foo
const MATCHES_EXTERNAL = /(^|\/)(bower_components|node_modules($|\/))/;

/**
 * Represents a queryable interface over all documents in a package/project.
 *
 * Results of queries will include results from all documents in the package, as
 * well as from external dependencies that are transitively imported by
 * documents in the package.
 */
export class Analysis implements Queryable {
  private readonly _results: ImmutableMap<ResolvedUrl, Document|Warning>;
  private readonly _searchRoots: ImmutableSet<Document>;

  static isExternal(path: string) {
    return MATCHES_EXTERNAL.test(path);
  }

  constructor(
      results: Map<ResolvedUrl, Document|Warning>,
      private readonly context: AnalysisContext) {
    workAroundDuplicateJsScriptsBecauseOfHtmlScriptTags(results);

    this._results = results;
    const documents =
        Array.from(results.values()).filter((r) => r instanceof Document) as
        Document[];
    const potentialRoots = new Set(documents);

    // We trim down the set of documents as a performance optimization. We only
    // need a set of documents such that all other documents we're interested in
    // can be reached from them. That way we'll do less duplicate work when we
    // query over all documents.
    for (const doc of potentialRoots) {
      for (const imprt of doc.getFeatures({kind: 'import', imported: true})) {
        // When there's cycles we can keep any element of the cycle, so why not
        // this one.
        if (imprt.document !== undefined && imprt.document !== doc) {
          potentialRoots.delete(imprt.document);
        }
      }
    }
    this._searchRoots = potentialRoots;
  }

  getDocument(packageRelativeUrl: string): Result<Document, Warning|undefined> {
    const url =
        this.context.resolver.resolve(packageRelativeUrl as PackageRelativeUrl);
    if (url === undefined) {
      return {successful: false, error: undefined};
    }
    const result = this._results.get(url);
    if (result != null) {
      if (result instanceof Document) {
        return {successful: true, value: result};
      } else {
        return {successful: false, error: result};
      }
    }
    const documents =
        Array
            .from(this.getFeatures(
                {kind: 'document', id: url, externalPackages: true}))
            .filter((d) => !d.isInline);
    if (documents.length !== 1) {
      return {successful: false, error: undefined};
    }
    return {successful: true, value: documents[0]!};
  }

  /**
   * Get features in the package.
   *
   * Be default this includes features in all documents inside the package,
   * but you can specify whether to also include features that are outside the
   * package reachable by documents inside. See the documentation for Query for
   * more details.
   *
   * You can also narrow by feature kind and identifier.
   */
  getFeatures<K extends FeatureKind>(query: QueryWithKind<K>):
      Set<FeatureKindMap[K]>;
  getFeatures(query?: Query): Set<Feature>;
  getFeatures(query: Query = {}): Set<Feature> {
    const result = new Set();
    const docQuery = this._getDocumentQuery(query);
    for (const doc of this._searchRoots) {
      addAll(result, doc.getFeatures(docQuery));
    }
    return result;
  }

  /**
   * Get all warnings in the project.
   */
  getWarnings(options?: Query): Warning[] {
    const warnings = Array.from(this._results.values())
                         .filter((r) => !(r instanceof Document)) as Warning[];
    const result = new Set(warnings);
    const docQuery = this._getDocumentQuery(options);
    for (const doc of this._searchRoots) {
      addAll(result, new Set(doc.getWarnings(docQuery)));
    }
    return Array.from(result);
  }

  /**
   * Potentially narrow down the document that contains the sourceRange.
   * For example, if a source range is inside a inlineDocument, this function
   * will narrow down the document to the most specific inline document.
   *
   * @param sourceRange Source range to search for in a document
   */
  getDocumentContaining(sourceRange: SourceRange|undefined): Document
      |undefined {
    if (!sourceRange) {
      return undefined;
    }
    let mostSpecificDocument: undefined|Document = undefined;
    const [outerDocument] =
        this.getFeatures({kind: 'document', id: sourceRange.file});
    if (!outerDocument) {
      return undefined;
    }
    for (const doc of outerDocument.getFeatures({kind: 'document'})) {
      if (isPositionInsideRange(sourceRange.start, doc.sourceRange)) {
        if (!mostSpecificDocument ||
            isPositionInsideRange(
                doc.sourceRange!.start, mostSpecificDocument.sourceRange)) {
          mostSpecificDocument = doc;
        }
      }
    }
    return mostSpecificDocument;
  }

  private _getDocumentQuery(query: Query = {}): DocumentQuery {
    return {
      kind: query.kind,
      id: query.id,
      externalPackages: query.externalPackages,
      imported: true,
      excludeBackreferences: query.excludeBackreferences,
      noLazyImports: query.noLazyImports,
    };
  }
}

/**
 * So, we have this really terrible hack, whereby we generate a new Document for
 * a js file when it is referenced in an external script tag in an HTML
 * document. We do this so that we can inject an artificial import of the HTML
 * document into the js document, so that the HTML document's dependencies are
 * also dependencies of the js document.
 *
 * This works, but we want to eliminate these duplicate JS Documents from the
 * Analysis before the user sees them.
 *
 * https://github.com/Polymer/polymer-analyzer/issues/615 tracks a better
 * solution for this issue
 */
function workAroundDuplicateJsScriptsBecauseOfHtmlScriptTags(
    results: Map<string, Document|Warning>) {
  const documents =
      Array.from(results.values()).filter((r) => r instanceof Document) as
      Document[];
  // TODO(rictic): handle JS imported via script src from HTML better than
  //     this.
  const potentialDuplicates =
      new Set(documents.filter((r) => r.kinds.has('js-document')));
  const canonicalOverrides = new Set<Document>();
  for (const doc of documents) {
    if (potentialDuplicates.has(doc)) {
      continue;
    }
    for (const potentialDupe of potentialDuplicates) {
      const potentialCanonicalDocs = doc.getFeatures(
          {kind: 'js-document', id: potentialDupe.url, imported: true});
      for (const potentialCanonicalDoc of potentialCanonicalDocs) {
        if (!potentialCanonicalDoc.isInline) {
          canonicalOverrides.add(potentialCanonicalDoc);
        }
      }
    }
  }

  for (const canonicalDoc of canonicalOverrides) {
    results.set(canonicalDoc.url, canonicalDoc);
  }
}
