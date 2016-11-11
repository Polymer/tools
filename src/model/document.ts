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

import {Analyzer} from '../analyzer';
import {ParsedDocument} from '../parser/document';
import {Behavior} from '../polymer/behavior';
import {DomModule} from '../polymer/dom-module-scanner';
import {PolymerElement} from '../polymer/polymer-element';
import {Warning} from '../warning/warning';

import {Element} from './element';
import {ElementReference} from './element-reference';
import {Feature, ScannedFeature} from './feature';
import {Import} from './import';
import {isResolvable} from './resolvable';
import {SourceRange} from './source-range';

/**
 * The metadata for all features and elements defined in one document
 */
export class ScannedDocument {
  document: ParsedDocument<any, any>;
  features: ScannedFeature[];
  isInline = false;
  sourceRange: SourceRange|undefined = undefined;  // TODO(rictic): track this
  warnings: Warning[];

  constructor(
      document: ParsedDocument<any, any>, features: ScannedFeature[],
      isInline: boolean, warnings?: Warning[]) {
    this.document = document;
    this.features = features;
    this.warnings = warnings || [];
    this.isInline = isInline;
  }

  get url() {
    return this.document.url;
  }
}

export class Document implements Feature {
  kinds: Set<string> = new Set(['document']);
  identifiers: Set<string> = new Set();
  analyzer: Analyzer;
  warnings: Warning[];

  private _localFeatures = new Set<Feature>();
  private _scannedDocument: ScannedDocument;

  /** See parsedDocument. */
  astNode: null = null;

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

  constructor(base: ScannedDocument, analyzer: Analyzer) {
    if (base == null) {
      throw new Error('base is null');
    }
    if (analyzer == null) {
      throw new Error('analyzer is null');
    }
    this._scannedDocument = base;
    this.analyzer = analyzer;

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

  get parsedDocument(): ParsedDocument<any, any> {
    return this._scannedDocument.document;
  }

  get sourceRange(): SourceRange|undefined {
    return this._scannedDocument.sourceRange;
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

  getByKind(kind: 'element'): Set<Element>;
  getByKind(kind: 'polymer-element'): Set<PolymerElement>;
  getByKind(kind: 'behavior'): Set<Behavior>;
  getByKind(kind: 'dom-module'): Set<DomModule>;
  getByKind(kind: 'document'): Set<Document>;
  getByKind(kind: 'import'): Set<Import>;
  getByKind(kind: 'element-reference'): Set<ElementReference>;
  getByKind(kind: string): Set<Feature>;
  getByKind(kind: string): Set<Feature> {
    if (this._featuresByKind) {
      // We have a fast index! Use that.
      return this._featuresByKind.get(kind) || new Set();
    } else if (this._doneResolving) {
      // We're done discovering features in this document and its children so
      // we can safely build up the indexes.
      this._buildIndexes();
      return this.getByKind(kind);
    }
    return this._getByKind(kind, new Set());
  }

  getById(kind: 'element', tagName: string): Set<Element>;
  getById(kind: 'polymer-element', tagName: string): Set<Document>;
  getById(kind: 'behavior', className: string): Set<Behavior>;
  getById(kind: 'dom-module', idAttr: string): Set<DomModule>;
  getById(kind: 'document', url: string): Set<Document>;
  getById(kind: 'element-reference', tagName: string): Set<ElementReference>;
  getById(kind: string, identifier: string): Set<Feature>;
  getById(kind: string, identifier: string): Set<Feature> {
    if (this._featuresByKindAndId) {
      // We have a fast index! Use that.
      const idMap = this._featuresByKindAndId.get(kind);
      return (idMap && idMap.get(identifier)) || new Set();
    } else if (this._doneResolving) {
      // We're done discovering features in this document and its children so
      // we can safely build up the indexes.
      this._buildIndexes();
      return this.getById(kind, identifier);
    }
    const result = new Set<Feature>();
    for (const featureOfKind of this.getByKind(kind)) {
      if (featureOfKind.identifiers.has(identifier)) {
        result.add(featureOfKind);
      }
    }
    return result;
  }

  getOnlyAtId(kind: 'element', tagName: string): Element|undefined;
  getOnlyAtId(kind: 'polymer-element', tagName: string): PolymerElement
      |undefined;
  getOnlyAtId(kind: 'behavior', className: string): Behavior|undefined;
  getOnlyAtId(kind: 'dom-module', idAttr: string): DomModule|undefined;
  getOnlyAtId(kind: 'document', url: string): Document|undefined;
  getOnlyAtId(kind: 'element-reference', tagName: string): ElementReference;
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

  private _getByKind(kind: string, documentsWalked: Set<Document>):
      Set<Feature> {
    const result = new Set<Feature>();
    documentsWalked.add(this);

    for (const feature of this._localFeatures) {
      if (feature.kinds.has(kind)) {
        result.add(feature);
      }
      if (feature.kinds.has('import')) {
        const document = (feature as Import).document;
        if (!documentsWalked.has(document)) {
          for (const subFeature of document._getByKind(kind, documentsWalked)) {
            result.add(subFeature);
          }
        }
      }
      if (feature.kinds.has('document')) {
        const document = (feature as Document);
        if (!documentsWalked.has(document)) {
          for (const subFeature of document._getByKind(kind, documentsWalked)) {
            result.add(subFeature);
          }
        }
      }
    }

    return result;
  }

  /**
   * Get features for all documents reachable via imports in this document.
   * If `deep` is false, only return features in this document.
   */
  getFeatures(deep?: boolean): Set<Feature> {
    if (deep == null) {
      deep = true;
    }
    const result = new Set<Feature>();
    this._getFeatures(result, new Set<Document>(), deep);
    return result;
  }

  private _getFeatures(
      result: Set<Feature>, visited: Set<Document>, deep: boolean) {
    if (visited.has(this)) {
      return;
    }
    visited.add(this);
    for (const feature of this._localFeatures) {
      result.add(feature);
      if (deep) {
        if (feature.kinds.has('document')) {
          (feature as Document)._getFeatures(result, visited, deep);
        }
        if (feature.kinds.has('import')) {
          (feature as Import).document._getFeatures(result, visited, deep);
        }
      }
    }
  }

  /**
   * Get warnings for this document and all local features of this document. If
   * `deep` is true, return warnings for all documents and features reachable
   * via imports in this document.
   */
  getWarnings(deep?: boolean): Warning[] {
    const warnings: Set<Warning> = new Set(this.warnings);
    if (deep == null) {
      deep = false;
    }
    for (const feature of this.getFeatures(deep)) {
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
            localFeature._toString(documentsWalked).map(line => `  ${line}`));
      } else {
        let subResult = localFeature.toString();
        if (subResult === '[object Object]') {
          subResult =
              `<${localFeature.constructor.name} kinds="${Array
                  .from(localFeature.kinds)
                  .join(', ')}" ids="${Array.from(localFeature.identifiers)
                  .join(',')}">}`;
        }
        result.push(`  ${subResult}`);
      }
    }

    return result;
  }

  stringify(): string {
    const inlineDocuments =
        (Array.from(this._localFeatures)
             .filter(f => f instanceof Document && f.isInline) as Document[])
            .map(d => d.parsedDocument);
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
    for (const feature of this.getFeatures()) {
      this._indexFeature(feature);
    }
  }
}
