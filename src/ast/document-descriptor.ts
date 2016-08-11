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

import * as util from 'util';

import {SourceLocation} from '../elements-format';
import {ParsedDocument} from '../parser/document';
import {Behavior} from '../polymer/behavior-descriptor';
import {ScannedDomModule} from '../polymer/dom-module-finder';
import {DomModule} from '../polymer/dom-module-finder';
import {PolymerElement} from '../polymer/element-descriptor';

import {ScannedFeature} from './descriptor';
import {Element, ScannedElement} from './element-descriptor';
import {Import, ScannedImport} from './import-descriptor';
import {InlineParsedDocument, LocationOffset} from './inline-document-descriptor';


/**
 * The metadata for all features and elements defined in one document
 */
export class ScannedDocument {
  document: ParsedDocument<any, any>;
  dependencies: ScannedDocument[];
  entities: ScannedFeature[];
  locationOffset?: LocationOffset;
  isInline = false;

  constructor(
      document: ParsedDocument<any, any>, dependencies: ScannedDocument[],
      entities: ScannedFeature[], locationOffset?: LocationOffset) {
    this.document = document;
    this.dependencies = dependencies;
    this.entities = entities;
    this.locationOffset = locationOffset;
  }

  get url() {
    return this.document.url;
  }
}

export interface Feature {
  kinds: Iterable<string>;
  identifiers?: Iterable<string>;
  // sourceLocation: SourceLocation;
}


export interface Resolvable extends ScannedFeature {
  resolve(document: Document): Feature;
}
function isResolvable(x: any): x is Resolvable {
  return x.resolve && typeof x.resolve === 'function';
}

const documentKinds = ['document'];
export class Document implements Feature {
  url: string;
  parsedDocument: ParsedDocument<any, any>;
  isInline: boolean;

  kinds: Iterable<string>;
  identifiers: Set<string>;

  private _rootDocument: Document;
  // Should be able to emulate this once every Feature has a SourceLocation by
  // just filtering out by feature.sourceLocation.file === this.url;
  private _localFeatures = new Set<Feature>();

  static makeRootDocument(scannedDocument: ScannedDocument): Document {
    const result = new Document(scannedDocument);
    result._addFeature(result);
    result._resolve(scannedDocument);
    return result;
  }

  private constructor(base: ScannedDocument, rootDocument?: Document) {
    if (rootDocument == null) {
      this._rootDocument = this;
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

    if (base.isInline) {
      this.identifiers = new Set();
    } else {
      this.identifiers = new Set([this.url]);
    }
    this.kinds = ['document', `${this.parsedDocument.type}-document`];
    this._addFeature(this);
  }

  private _isResolved = false;
  private _resolve(base: ScannedDocument) {
    if (this._isResolved) {
      return;
    }
    this._isResolved = true;
    const dependenciesByUrl = new Map(
        base.dependencies.map((sd) => <[string, ScannedDocument]>[sd.url, sd]));
    let i = 0;  // DELETE ME
    for (const scannedFeature of base.entities) {
      i += 1;
      if (scannedFeature instanceof ScannedImport) {
        const scannedDoc = dependenciesByUrl.get(scannedFeature.url)!;
        const imprt = scannedFeature.resolve(this._rootDocument);
        this._addFeature(imprt);
        const document = new Document(scannedDoc, this._rootDocument);
        imprt.document = document;
        this._addFeature(document);

        document._resolve(scannedDoc);
      } else if (scannedFeature instanceof InlineParsedDocument) {
        const document =
            new Document(scannedFeature.scannedDocument, this._rootDocument);
        this._addFeature(document);
        document._resolve(scannedFeature.scannedDocument);
      } else if (isResolvable(scannedFeature)) {
        const feature = scannedFeature.resolve(this._rootDocument);
        this._addFeature(feature);
      }
    }
  }

  getByKind(kind: 'element'): Set<Element>;
  getByKind(kind: 'polymer-element'): Set<PolymerElement>;
  getByKind(kind: 'behavior'): Set<Behavior>;
  getByKind(kind: 'dom-module'): Set<DomModule>;
  getByKind(kind: 'document'): Set<Document>;
  getByKind(kind: 'import'): Set<Import>;
  getByKind(kind: string): Set<Feature>;
  getByKind(kind: string): Set<Feature> {
    return this._getByKind(kind, new Set());
  }

  getById(kind: 'element', tagName: string): Set<Element>;
  getById(kind: 'polymer-element', tagName: string): Set<Document>;
  getById(kind: 'behavior', className: string): Set<Behavior>;
  getById(kind: 'dom-module', idAttr: string): Set<DomModule>;
  getById(kind: 'document', url: string): Set<Document>;
  getById(kind: string, identifier: string): Set<Feature>;
  getById(kind: string, identifier: string): Set<Feature> {
    const result = new Set<Feature>();
    for (const featureOfKind of this.getByKind(kind)) {
      if (iterableHas(featureOfKind.identifiers, identifier)) {
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

  private _getByKind(kind: string, documentsWalked: Set<Document>):
      Set<Feature> {
    const result = new Set<Feature>();
    if (documentsWalked.has(this)) {
      return result;
    }
    documentsWalked.add(this);
    for (const feature of this._localFeatures) {
      if (iterableHas(feature.kinds, kind)) {
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

  private _addFeature(feature: Feature) {
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
              `<${localFeature.constructor.name} kinds="${Array.from(localFeature.kinds).join(', ')}" ids="${Array.from(localFeature.identifiers).join(',')}">}`;
        }
        result.push(`  ${subResult}`);
      }
    }

    return result;
  }
}

function iterableHas<Elem>(haystack: Iterable<Elem>, needle: Elem): boolean {
  if (haystack instanceof Set) {
    return haystack.has(needle);
  } else if (Array.isArray(haystack)) {
    return haystack.indexOf(needle) >= 0;
  }
  for (const element of haystack) {
    if (element === needle) {
      return true;
    }
  }
  return false;
}