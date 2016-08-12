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

import {SourceLocation} from '../elements-format';
import * as jsdoc from '../javascript/jsdoc';

import {Document, Event, Feature, LocationOffset, Property, Resolvable, ScannedEvent, ScannedFeature, ScannedProperty, correctSourceLocation} from './ast';

export {Visitor} from '../javascript/estree-visitor';

export interface ScannedAttribute {
  name: string;
  sourceLocation: SourceLocation;
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
  sourceLocation: SourceLocation;
  node: estree.Node;

  jsdoc?: jsdoc.Annotation;

  applyLocationOffset(locationOffset?: LocationOffset) {
    if (!locationOffset) {
      return;
    }
    this.sourceLocation =
        correctSourceLocation(this.sourceLocation, locationOffset);
    for (const prop of this.properties) {
      prop.sourceLocation =
          correctSourceLocation(prop.sourceLocation, locationOffset);
    }
    for (const attribute of this.attributes) {
      attribute.sourceLocation =
          correctSourceLocation(attribute.sourceLocation, locationOffset);
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
  sourceLocation: SourceLocation;
  jsdoc?: jsdoc.Annotation;
  kinds: Iterable<string> = ['element'];
  get identifiers(): Iterable<string> {
    const result: string[] = [];
    if (this.tagName) {
      result.push(this.tagName);
    }
    if (this.className) {
      result.push(this.className);
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
