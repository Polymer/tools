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
import * as jsdoc from '../javascript/jsdoc';
import {SourceRange} from '../model/model';
import {Warning} from '../warning/warning';

import {Document, Event, Feature, Property, Resolvable, ScannedEvent, ScannedProperty} from './model';

export {Visitor} from '../javascript/estree-visitor';

export interface ScannedAttribute {
  name: string;
  sourceRange: SourceRange|undefined;
  description?: string;
  type?: string;
}

export class ScannedElement implements Resolvable {
  tagName?: string;
  className?: string;
  superClass?: string;
  extends?: string;
  properties: ScannedProperty[] = [];
  attributes: ScannedAttribute[] = [];
  description = '';
  demos: {desc?: string; path: string}[] = [];
  events: ScannedEvent[] = [];
  sourceRange: SourceRange|undefined;
  astNode: estree.Node|null;
  warnings: Warning[] = [];
  slots: Slot[] = [];

  jsdoc?: jsdoc.Annotation;

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

export class Slot {
  name: string;
  range: SourceRange;

  constructor(name: string, range: SourceRange) {
    this.name = name;
    this.range = range;
  }
}

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
  astNode: estree.Node|null;
  kinds: Set<string> = new Set(['element']);
  warnings: Warning[] = [];
  slots: Slot[] = [];
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
