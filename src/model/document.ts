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
import * as dom5 from 'dom5';

import {AnalysisContext} from '../core/analysis-context';
import {ParsedDocument} from '../parser/document';

import {Analysis} from './analysis';
import {Feature, ScannedFeature} from './feature';
import {ImmutableSet, unsafeAsMutable} from './immutable';
import {Import} from './import';
import {ScannedInlineDocument} from './inline-document';
import {DocumentQuery as Query, DocumentQueryWithKind as QueryWithKind, FeatureKind, FeatureKindMap, Queryable} from './queryable';
import {isResolvable} from './resolvable';
import {SourceRange} from './source-range';
import {ResolvedUrl} from './url';
import {Warning} from './warning';

/**
 * The metadata for all features and elements defined in one document
 */
export class ScannedDocument {
  document: ParsedDocument;
  features: ScannedFeature[];
  warnings: Warning[];
  isInline = false;

  get sourceRange() {
    return this.document.sourceRange;
  }
  get astNode() {
    return this.document.astNode;
  }

  constructor(
      document: ParsedDocument, features: ScannedFeature[],
      warnings: Warning[] = []) {
    this.document = document;
    this.features = features;
    this.warnings = warnings;
    this.isInline = document.isInline;
  }

  get url() {
    return this.document.url;
  }

  /**
   * Gets all features in this scanned document and all inline documents it
   * contains.
   */
  getNestedFeatures(): ScannedFeature[] {
    const result: ScannedFeature[] = [];
    this._getNestedFeatures(result);
    return result;
  }

  private _getNestedFeatures(features: ScannedFeature[]): void {
    for (const feature of this.features) {
      // Ad hoc test needed here to avoid a problematic import loop.
      const maybeInlineDoc = feature as Partial<ScannedInlineDocument>;
      if (maybeInlineDoc.constructor.name === 'ScannedInlineDocument' &&
          maybeInlineDoc.scannedDocument) {
        maybeInlineDoc.scannedDocument._getNestedFeatures(features);
      } else {
        features.push(feature);
      }
    }
  }
}

declare module './queryable' {
  interface FeatureKindMap {
    'document': Document;

    // Document specializations.
    'html-document': Document;
    'js-document': Document;
    'json-document': Document;
    'css-document': Document;
  }
}
export class Document implements Feature, Queryable {
  readonly kinds: ImmutableSet<string> = new Set(['document']);
  readonly identifiers: ImmutableSet<string> = new Set();

  /**
   * AnalysisContext is a private type. Only internal analyzer code should touch
   * this field.
   */
  _analysisContext: AnalysisContext;
  warnings: Warning[];
  languageAnalysis?: any;

  private readonly _localFeatures = new Set<Feature>();
  private readonly _scannedDocument: ScannedDocument;


  /**
   * To handle recursive dependency graphs we must track whether we've started
   * resolving this Document so that we can reliably early exit even if one
   * of our dependencies tries to resolve this document.
   */
  private _begunResolving = false;

  /**
   * True after this document and all of its children are finished resolving.
   */
  private _doneResolving = false;

  constructor(
      base: ScannedDocument, analyzer: AnalysisContext,
      languageAnalysis?: any) {
    if (base == null) {
      throw new Error('base is null');
    }
    if (analyzer == null) {
      throw new Error('analyzer is null');
    }
    this._scannedDocument = base;
    this._analysisContext = analyzer;
    this.languageAnalysis = languageAnalysis;

    if (!base.isInline) {
      unsafeAsMutable(this.identifiers).add(this.url);
    }
    unsafeAsMutable(this.kinds).add(`${this.parsedDocument.type}-document`);
    this.warnings = Array.from(base.warnings);
  }

  get url(): ResolvedUrl {
    return this._scannedDocument.url;
  }

  get isInline(): boolean {
    return this._scannedDocument.isInline;
  }

  get sourceRange(): SourceRange|undefined {
    return this._scannedDocument.sourceRange;
  }

  get astNode(): dom5.Node|undefined {
    return this._scannedDocument.astNode;
  }

  get parsedDocument(): ParsedDocument {
    return this._scannedDocument.document;
  }

  get resolved(): boolean {
    return this._doneResolving;
  }

  get type(): string {
    return this.parsedDocument.type;
  }

  /**
   * Resolves all features of this document, so that they have references to all
   * their dependencies.
   *
   * This method can only be called once
   */
  // TODO(justinfagnani): move to ScannedDocument
  resolve() {
    if (this._doneResolving) {
      throw new Error('resolve can only be called once');
    }
    if (this._begunResolving) {
      return;
    }
    this._begunResolving = true;
    this._addFeature(this);
    for (const scannedFeature of this._scannedDocument.features) {
      if (isResolvable(scannedFeature)) {
        const feature = scannedFeature.resolve(this);
        if (feature) {
          this._addFeature(feature);
        }
      }
    }
    this._doneResolving = true;
  }

  /**
   * Adds and indexes a feature to this documentled before resolve().
   */
  _addFeature(feature: Feature) {
    if (this._doneResolving) {
      throw new Error('_addFeature can not be called after _resolve()');
    }
    this._indexFeature(feature);
    this._localFeatures.add(feature);
  }

  /**
   * Get features on the document.
   *
   * Be default it includes only features on the document, but you can specify
   * whether to include features that are reachable by imports, features from
   * outside the current package, etc. See the documentation for Query for more
   * details.
   *
   * You can also narrow by feature kind and identifier.
   */
  getFeatures<K extends FeatureKind>(query: QueryWithKind<K>):
      Set<FeatureKindMap[K]>;
  getFeatures(query?: Query): Set<Feature>;
  getFeatures(query: Query = {}): Set<Feature> {
    if (query.id && query.kind) {
      return this._getById(query.kind, query.id, query);
    } else if (query.kind) {
      return this._getByKind(query.kind, query);
    }
    const features = new Set();
    this._listFeatures(features, new Set(), query);
    const queryId = query.id;
    if (queryId) {
      const filteredFeatures =
          Array.from(features).filter((f) => f.identifiers.has(queryId));
      return new Set(filteredFeatures);
    }
    return features;
  }

  private _getByKind<K extends FeatureKind>(kind: K, query?: Query):
      Set<FeatureKindMap[K]>;
  private _getByKind(kind: string, query?: Query): Set<Feature>;
  private _getByKind(kind: string, query: Query = {}): Set<Feature> {
    if (this._featuresByKind && this._isCachable(query)) {
      // We have a fast index! Use that.
      const features = this._featuresByKind.get(kind) || new Set();
      if (!query.externalPackages) {
        return this._filterOutExternal(features);
      }
      return features;
    } else if (this._doneResolving && this._isCachable(query)) {
      // We're done discovering features in this document and its children so
      // we can safely build up the indexes.
      this._buildIndexes();
      return this._getByKind(kind, query);
    }
    return this._getSlowlyByKind(kind, query);
  }

  private _getById<K extends FeatureKind>(
      kind: K, identifier: string, query?: Query): Set<FeatureKindMap[K]>;
  private _getById(kind: string, identifier: string, query?: Query):
      Set<Feature>;
  private _getById(kind: string, identifier: string, query: Query = {}):
      Set<Feature> {
    if (this._featuresByKindAndId && this._isCachable(query)) {
      // We have a fast index! Use that.
      const idMap = this._featuresByKindAndId.get(kind);
      const features = (idMap && idMap.get(identifier)) || new Set();
      if (!query.externalPackages) {
        return this._filterOutExternal(features);
      }
      return features;
    } else if (this._doneResolving && this._isCachable(query)) {
      // We're done discovering features in this document and its children so
      // we can safely build up the indexes.
      this._buildIndexes();
      return this._getById(kind, identifier, query);
    }
    const result = new Set<Feature>();
    for (const featureOfKind of this._getByKind(kind, query)) {
      if (featureOfKind.identifiers.has(identifier)) {
        result.add(featureOfKind);
      }
    }
    return result;
  }

  private _isCachable(query: Query = {}): boolean {
    return !!query.imported && !query.noLazyImports;
  }

  private _getSlowlyByKind(kind: string, query: Query): Set<Feature> {
    const allFeatures = new Set<Feature>();
    this._listFeatures(allFeatures, new Set(), query);

    const result = new Set<Feature>();
    for (const feature of allFeatures) {
      if (feature.kinds.has(kind)) {
        result.add(feature);
      }
    }

    return result;
  }

  /**
   * Walks the graph of documents, starting from `this`, finding features which
   * match the given query and adding them to the `result` set. Uses `visited`
   * to deal with cycles.
   *
   * This method is O(numFeatures), though it does not walk documents that are
   * not relevant to the query (e.g. based on whether the query follows imports,
   * or excludes lazy imports)
   */
  private _listFeatures(
      result: Set<Feature>, visited: Set<Document>, query: Query) {
    if (visited.has(this)) {
      return;
    }
    visited.add(this);
    for (const feature of this._localFeatures) {
      result.add(feature);
      if (feature.kinds.has('document')) {
        (feature as Document)._listFeatures(result, visited, query);
      }
      if (feature.kinds.has('import') && query.imported) {
        const imprt = feature as Import;
        const isPackageInternal =
            imprt.document && !Analysis.isExternal(imprt.document.url);
        const externalityOk = query.externalPackages || isPackageInternal;
        const lazinessOk = !query.noLazyImports || !imprt.lazy;
        if (externalityOk && lazinessOk) {
          imprt.document._listFeatures(result, visited, query);
        }
      }
    }
  }

  private _filterOutExternal(features: Set<Feature>): Set<Feature> {
    const result = new Set();
    for (const feature of features) {
      if (feature.sourceRange &&
          Analysis.isExternal(feature.sourceRange.file)) {
        continue;
      }
      result.add(feature);
    }
    return result;
  }

  /**
   * Get warnings for the document and all matched features.
   */
  getWarnings(query: Query = {}): Warning[] {
    const warnings: Set<Warning> = new Set(this.warnings);
    for (const feature of this.getFeatures(query)) {
      for (const warning of feature.warnings) {
        warnings.add(warning);
      }
    }
    return Array.from(warnings);
  }

  toString(): string {
    return this._toString(new Set()).join('\n');
  }

  private _toString(documentsWalked: Set<Document>) {
    let result =
        [`<Document type=${this.parsedDocument.type} url=${this.url}>\n`];
    if (documentsWalked.has(this)) {
      return result;
    }
    documentsWalked.add(this);

    for (const localFeature of this._localFeatures) {
      if (localFeature instanceof Document) {
        result = result.concat(
            localFeature._toString(documentsWalked).map((line) => `  ${line}`));
      } else {
        let subResult = localFeature.toString();
        if (subResult === '[object Object]') {
          subResult = `<${localFeature.constructor.name} kinds="${
              Array.from(localFeature.kinds).join(', ')}" ids="${
              Array.from(localFeature.identifiers).join(',')}">}`;
        }
        result.push(`  ${subResult}`);
      }
    }

    return result;
  }

  stringify(): string {
    const inlineDocuments =
        (Array.from(this._localFeatures)
             .filter((f) => f instanceof Document && f.isInline) as Document[])
            .map((d) => d.parsedDocument);
    return this.parsedDocument.stringify({inlineDocuments: inlineDocuments});
  }

  private _indexFeature(feature: Feature) {
    if (!this._featuresByKind || !this._featuresByKindAndId) {
      return;
    }
    for (const kind of feature.kinds) {
      const kindSet = this._featuresByKind.get(kind) || new Set<Feature>();
      kindSet.add(feature);
      this._featuresByKind.set(kind, kindSet);
      for (const id of feature.identifiers) {
        const identifiersMap = this._featuresByKindAndId.get(kind) ||
            new Map<string, Set<Feature>>();
        this._featuresByKindAndId.set(kind, identifiersMap);
        const idSet = identifiersMap.get(id) || new Set<Feature>();
        identifiersMap.set(id, idSet);
        idSet.add(feature);
      }
    }
  }

  private _featuresByKind: Map<string, Set<Feature>>|null = null;
  private _featuresByKindAndId: Map<string, Map<string, Set<Feature>>>|null =
      null;
  private _buildIndexes() {
    if (this._featuresByKind) {
      throw new Error(
          'Tried to build indexes multiple times. This should never happen.');
    }
    if (!this._doneResolving) {
      throw new Error(
          `Tried to build indexes before finished resolving. ` +
          `Need to wait until afterwards or the indexes would be incomplete.`);
    }
    this._featuresByKind = new Map<string, Set<Feature>>();
    this._featuresByKindAndId = new Map<string, Map<string, Set<Feature>>>();
    for (const feature of this.getFeatures(
             {imported: true, externalPackages: true})) {
      this._indexFeature(feature);
    }
  }
}
