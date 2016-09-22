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

import {ParsedDocument} from '../parser/document';
import {Behavior} from '../polymer/behavior-descriptor';
import {DomModule} from '../polymer/dom-module-scanner';
import {PolymerElement} from '../polymer/element-descriptor';
import {Warning} from '../warning/warning';

import {Element} from './element';
import {Feature, ScannedFeature} from './feature';
import {Import, ScannedImport} from './import';
import {InlineParsedDocument} from './inline-document';
import {isResolvable} from './resolvable';
import {LocationOffset, SourceRange} from './source-range';



/**
 * The metadata for all features and elements defined in one document
 */
export class ScannedDocument {
  document: ParsedDocument<any, any>;
  dependencies: ScannedDocument[];
  features: ScannedFeature[];
  locationOffset?: LocationOffset;
  isInline = false;
  sourceRange: SourceRange = null;  // TODO(rictic): track this
  warnings: Warning[];

  constructor(
      document: ParsedDocument<any, any>, dependencies: ScannedDocument[],
      features: ScannedFeature[], locationOffset?: LocationOffset,
      warnings?: Warning[]) {
    this.document = document;
    this.dependencies = dependencies;
    this.features = features;
    this.locationOffset = locationOffset;
    this.warnings = warnings || [];
  }

  get url() {
    return this.document.url;
  }
}

export class Document implements Feature {
  url: string;
  parsedDocument: ParsedDocument<any, any>;
  isInline: boolean;

  kinds: Set<string>;
  identifiers: Set<string>;
  sourceRange: SourceRange;

  private _rootDocument: Document;
  private _localFeatures = new Set<Feature>();
  private _warnings: Warning[];

  /**
   * True after this document and all of its children are finished resolving.
   */
  private _doneResolving = false;

  static makeRootDocument(scannedDocument: ScannedDocument): Document {
    const result = new Document(scannedDocument);
    result._addFeature(result);
    result._resolve(scannedDocument);
    return result;
  }

  private constructor(base: ScannedDocument, rootDocument?: Document) {
    if (rootDocument == null) {
      this._rootDocument = this;
      this._initIndexes();
    } else {
      if (!base.isInline) {
        const existingInstance = rootDocument.getOnlyAtId('document', base.url);
        if (existingInstance) {
          return existingInstance;
        }
      }
      this._rootDocument = rootDocument;
    }
    this.url = base.url;
    this.isInline = base.isInline;
    this.parsedDocument = base.document;
    this.sourceRange = base.sourceRange;
    this._warnings = base.warnings;

    if (base.isInline) {
      this.identifiers = new Set();
    } else {
      this.identifiers = new Set([this.url]);
    }
    this.kinds = new Set(['document', `${this.parsedDocument.type}-document`]);
    this._addFeature(this);
  }

  /**
   * To handle recursive dependency graphs we must track whether we've started
   * resolving this Document so that we can reliably early exit even if one
   * of our dependencies tries to resolve this document.
   */
  private _begunResolving = false;
  private _resolve(base: ScannedDocument) {
    if (this._begunResolving) {
      return;
    }
    this._begunResolving = true;
    for (const scannedFeature of base.features) {
      if (scannedFeature instanceof ScannedImport) {
        this._resolveScannedImport(scannedFeature);

      } else if (scannedFeature instanceof InlineParsedDocument) {
        this._resolveInlineDocument(scannedFeature);

      } else if (isResolvable(scannedFeature)) {
        const feature = scannedFeature.resolve(this._rootDocument);
        this._addFeature(feature);
      }
    }
    this._doneResolving = true;
  }

  private _resolveScannedImport(scannedImport: ScannedImport) {
    const imprt = scannedImport.resolve(this._rootDocument);
    this._addFeature(imprt);

    const scannedDoc = scannedImport.scannedDocument;
    if (!scannedDoc) {
      // There was a load or parse error, the scanned doc doesn't exist.
      return;
    }

    const document = new Document(scannedDoc, this._rootDocument);
    imprt.document = document;
    this._addFeature(document);

    document._resolve(scannedDoc);
  }

  private _resolveInlineDocument(inlineDoc: InlineParsedDocument) {
    if (!inlineDoc.scannedDocument) {
      // Parse error on the inline document.
      return;
    }
    const document =
        new Document(inlineDoc.scannedDocument, this._rootDocument);
    this._addFeature(document);
    document._resolve(inlineDoc.scannedDocument);
  }

  getByKind(kind: 'element'): Set<Element>;
  getByKind(kind: 'polymer-element'): Set<PolymerElement>;
  getByKind(kind: 'behavior'): Set<Behavior>;
  getByKind(kind: 'dom-module'): Set<DomModule>;
  getByKind(kind: 'document'): Set<Document>;
  getByKind(kind: 'import'): Set<Import>;
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

  getWarnings(): Warning[] {
    // TODO(rictic): crawl (local?) features and grab their warnings too.
    return this._warnings;
  }

  private _getByKind(kind: string, documentsWalked: Set<Document>):
      Set<Feature> {
    const result = new Set<Feature>();
    if (documentsWalked.has(this)) {
      return result;
    }
    documentsWalked.add(this);
    for (const feature of this._localFeatures) {
      if (feature.kinds.has(kind)) {
        result.add(feature);
      }
      if (feature instanceof Document) {
        for (const subFeature of feature._getByKind(kind, documentsWalked)) {
          result.add(subFeature);
        }
      }
    }
    return result;
  }

  getFeatures(): Set<Feature> {
    const result = new Set<Feature>();
    this._getFeatures(result, new Set<Document>());
    return result;
  }

  private _getFeatures(
      inProgress: Set<Feature>, documentsWalked: Set<Document>) {
    if (documentsWalked.has(this)) {
      return;
    }
    documentsWalked.add(this);
    for (const feature of this._localFeatures) {
      inProgress.add(feature);
      if (feature instanceof Document) {
        feature._getFeatures(inProgress, documentsWalked);
      }
    }
  }

  private _addFeature(feature: Feature) {
    this._rootDocument._indexFeature(feature);
    this._localFeatures.add(feature);
  }

  toString(): string {
    return this._toString(new Set()).join('\n');
  }

  private _toString(documentsWalked: Set<Document>) {
    let result =
        [`<Document type="${this.parsedDocument.type}" url="${this.url}>\n`];
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

  private _featuresByKind: Map<string, Set<Feature>> = null;
  private _featuresByKindAndId: Map<string, Map<string, Set<Feature>>> = null;
  private _initIndexes() {
    this._featuresByKind = new Map<string, Set<Feature>>();
    this._featuresByKindAndId = new Map<string, Map<string, Set<Feature>>>();
  }

  private _indexFeature(feature: Feature) {
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
    if (this._rootDocument === this) {
      throw new Error(
          '_buildIndexes should only be called on non-root documents.');
    }
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
