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
import {Function} from '../javascript/function';
import {Namespace} from '../javascript/namespace';
import {ParsedDocument} from '../parser/document';
import {Behavior} from '../polymer/behavior';
import {DomModule} from '../polymer/dom-module-scanner';
import {PolymerElement} from '../polymer/polymer-element';
import {PolymerElementMixin} from '../polymer/polymer-element-mixin';

import {Analysis} from './analysis';
import {Element} from './element';
import {ElementMixin} from './element-mixin';
import {ElementReference} from './element-reference';
import {Feature, ScannedFeature} from './feature';
import {Import} from './import';
import {BaseQueryOptions, Queryable} from './queryable';
import {isResolvable} from './resolvable';
import {SourceRange} from './source-range';
import {Warning} from './warning';

/**
 * The metadata for all features and elements defined in one document
 */
export class ScannedDocument {
  document: ParsedDocument<any, any>;
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
      document: ParsedDocument<any, any>, features: ScannedFeature[],
      warnings?: Warning[]) {
    this.document = document;
    this.features = features;
    this.warnings = warnings || [];
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
      if (feature.constructor.name === 'ScannedDocument' &&
          feature['scannedDocument']) {
        const innerDoc = feature['scannedDocument'] as ScannedDocument;
        innerDoc._getNestedFeatures(features);
      } else {
        features.push(feature);
      }
    }
  }
}

// A map between kind string literal types and their feature types.
export interface FeatureKinds {
  'document': Document;
  'element': Element;
  'element-mixin': ElementMixin;
  'polymer-element': PolymerElement;
  'polymer-element-mixin': PolymerElementMixin;
  'behavior': Behavior;
  'namespace': Namespace;
  'function': Function;
  'dom-module': DomModule;
  'element-reference': ElementReference;
  'import': Import;

  // Document specializations.
  'html-document': Document;
  'js-document': Document;
  'json-document': Document;
  'css-document': Document;

  // Import specializations.
  'html-import': Import;
  'html-script': Import;
  'html-style': Import;
  'js-import': Import;
  'css-import': Import;
}

export interface QueryOptionsInterface extends BaseQueryOptions {
  /**
   * If true, the query will return results from the document and its
   * dependencies. Otherwise it will only include results from the document.
   */
  imported?: boolean;
}

export type QueryOptions = object & QueryOptionsInterface;

export class Document implements Feature, Queryable {
  kinds: Set<string> = new Set(['document']);
  identifiers: Set<string> = new Set();

  /**
   * AnalysisContext is a private type. Only internal analyzer code should touch
   * this field.
   */
  _analysisContext: AnalysisContext;
  warnings: Warning[];
  languageAnalysis?: any;

  private _localFeatures = new Set<Feature>();
  private _scannedDocument: ScannedDocument;


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
      this.identifiers.add(this.url);
    }
    this.kinds.add(`${this.parsedDocument.type}-document`);
    this.warnings = Array.from(base.warnings);
  }

  get url(): string {
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

  get parsedDocument(): ParsedDocument<any, any> {
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

  getByKind<K extends keyof FeatureKinds>(kind: K, options?: QueryOptions):
      Set<FeatureKinds[K]>;
  getByKind(kind: string, options?: QueryOptions): Set<Feature>;
  getByKind(kind: string, options?: QueryOptions): Set<Feature> {
    options = options || {};
    if (this._featuresByKind && this._isCachable(options)) {
      // We have a fast index! Use that.
      const features = this._featuresByKind.get(kind) || new Set();
      if (!options.externalPackages) {
        return this._filterOutExternal(features);
      }
      return features;
    } else if (this._doneResolving && this._isCachable(options)) {
      // We're done discovering features in this document and its children so
      // we can safely build up the indexes.
      this._buildIndexes();
      return this.getByKind(kind, options);
    }
    return this._getByKind(kind, options);
  }

  getById<K extends keyof FeatureKinds>(
      kind: K, identifier: string,
      options?: QueryOptions): Set<FeatureKinds[K]>;
  getById(kind: string, identifier: string, options?: QueryOptions):
      Set<Feature>;
  getById(kind: string, identifier: string, options?: QueryOptions):
      Set<Feature> {
    options = options || {};
    if (this._featuresByKindAndId && this._isCachable(options)) {
      // We have a fast index! Use that.
      const idMap = this._featuresByKindAndId.get(kind);
      const features = (idMap && idMap.get(identifier)) || new Set();
      if (!options.externalPackages) {
        return this._filterOutExternal(features);
      }
      return features;
    } else if (this._doneResolving && this._isCachable(options)) {
      // We're done discovering features in this document and its children so
      // we can safely build up the indexes.
      this._buildIndexes();
      return this.getById(kind, identifier, options);
    }
    const result = new Set<Feature>();
    for (const featureOfKind of this.getByKind(kind, options)) {
      if (featureOfKind.identifiers.has(identifier)) {
        result.add(featureOfKind);
      }
    }
    return result;
  }

  getOnlyAtId<K extends keyof FeatureKinds>(
      kind: K, identifier: string,
      options?: QueryOptions): FeatureKinds[K]|undefined;
  getOnlyAtId(kind: string, identifier: string, options?: QueryOptions): Feature
      |undefined;
  getOnlyAtId(kind: string, identifier: string, options?: QueryOptions): Feature
      |undefined {
    const results = this.getById(kind, identifier, options);
    if (results.size > 1) {
      throw new Error(
          `Expected to find at most one ${kind} with id ${identifier} ` +
          `but found ${results.size}.`);
    }
    return results.values().next().value || undefined;
  }

  getFeatures(options?: QueryOptions): Set<Feature> {
    options = options || {};
    const result = new Set<Feature>();
    this._getFeatures(result, new Set<Document>(), options);
    return result;
  }

  private _isCachable(options?: QueryOptions): boolean {
    options = options || {};
    return !!options.imported && !options.noLazyImports;
  }

  private _getByKind(kind: string, options: QueryOptions): Set<Feature> {
    const allFeatures = new Set<Feature>();
    this._getFeatures(allFeatures, new Set(), options);

    const result = new Set<Feature>();
    for (const feature of allFeatures) {
      if (feature.kinds.has(kind)) {
        result.add(feature);
      }
    }

    return result;
  }

  private _getFeatures(
      result: Set<Feature>, visited: Set<Document>, options: QueryOptions) {
    if (visited.has(this)) {
      return;
    }
    visited.add(this);
    for (const feature of this._localFeatures) {
      result.add(feature);
      if (feature.kinds.has('document')) {
        (feature as Document)._getFeatures(result, visited, options);
      }
      if (feature.kinds.has('import') && options.imported) {
        const imprt = feature as Import;
        const isPackageInternal =
            imprt.document && !Analysis.isExternal(imprt.document.url);
        const externalityOk = options.externalPackages || isPackageInternal;
        const lazinessOk = !options.noLazyImports || !imprt.lazy;
        if (externalityOk && lazinessOk) {
          imprt.document._getFeatures(result, visited, options);
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
  getWarnings(options?: QueryOptions): Warning[] {
    const warnings: Set<Warning> = new Set(this.warnings);
    for (const feature of this.getFeatures(options)) {
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
          subResult = `<${
                          localFeature.constructor.name
                        } kinds="${
                                   Array.from(localFeature.kinds).join(', ')
                                 }" ids="${
                                           Array.from(localFeature.identifiers)
                                               .join(',')
                                         }">}`;
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

  private _featuresByKind: Map<string, Set<Feature>>|null = null;
  private _featuresByKindAndId: Map<string, Map<string, Set<Feature>>>|null =
      null;
  private _initIndexes() {
    this._featuresByKind = new Map<string, Set<Feature>>();
    this._featuresByKindAndId = new Map<string, Map<string, Set<Feature>>>();
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
    this._initIndexes();
    for (const feature of this.getFeatures(
             {imported: true, externalPackages: true})) {
      this._indexFeature(feature);
    }
  }
}
