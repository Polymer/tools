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

import * as estree from 'estree';

import {SourceRange} from '../ast/ast';
import * as jsdoc from '../javascript/jsdoc';

import {Document, Event, Feature, LocationOffset, Property, Resolvable, ScannedEvent, ScannedFeature, ScannedProperty, correctSourceRange} from './ast';

export {Visitor} from '../javascript/estree-visitor';

export interface ScannedAttribute {
  name: string;
  sourceRange: SourceRange;
  description?: string;
  type?: string;
}

export class ScannedElement implements ScannedFeature, Resolvable {
  tagName?: string;
  className?: string;
  superClass?: string;
  extends?: string;
  properties: ScannedProperty[] = [];
  attributes: ScannedAttribute[] = [];
  description = '';
  demos: {desc?: string; path: string}[] = [];
  events: ScannedEvent[] = [];
  node: estree.Node;
  sourceRange: SourceRange;

  jsdoc?: jsdoc.Annotation;

  applyLocationOffset(locationOffset?: LocationOffset) {
    if (!locationOffset) {
      return;
    }
    this.sourceRange = correctSourceRange(this.sourceRange, locationOffset);
    for (const prop of this.properties) {
      prop.sourceRange = correctSourceRange(prop.sourceRange, locationOffset);
    }
    for (const attribute of this.attributes) {
      attribute.sourceRange =
          correctSourceRange(attribute.sourceRange, locationOffset);
    }
    for (const event of this.events) {
      event.sourceRange = correctSourceRange(event.sourceRange, locationOffset);
    }
  }

  applyHtmlComment(commentText: string|undefined) {
    this.description = this.description || commentText || '';
  }

  resolve(_document: Document): Element {
    const element = new Element();
    Object.assign(element, this);
    return element;
  }
}


export interface Attribute extends ScannedAttribute { inheritedFrom?: string; }

export class Element implements Feature {
  tagName?: string;
  className?: string;
  superClass?: string;
  extends?: string;
  properties: Property[] = [];
  attributes: Attribute[] = [];
  description = '';
  demos: {desc?: string; path: string}[] = [];
  events: Event[] = [];
  sourceRange: SourceRange;
  jsdoc?: jsdoc.Annotation;
  kinds: Set<string> = new Set(['element']);
  get identifiers(): Set<string> {
    const result: Set<string> = new Set();
    if (this.tagName) {
      result.add(this.tagName);
    }
    if (this.className) {
      result.add(this.className);
    }
    return result;
  }

  emitMetadata(): Object {
    return {};
  }

  emitAttributeMetadata(_attribute: Attribute): Object {
    return {};
  }

  emitPropertyMetadata(_property: Property): Object {
    return {};
  }

  emitEventMetadata(_event: Event): Object {
    return {};
  }
}
