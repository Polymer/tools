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

import {SourceRange} from '../model/model';

import {ElementBase, ScannedElementBase} from './element-base';
import {Attribute, Document, Event, Feature, Property} from './model';
export {Visitor} from '../javascript/estree-visitor';

export class ScannedElement extends ScannedElementBase {
  tagName?: string;
  className?: string;
  superClass?: string;
  extends?: string;
  slots:
  Slot[] = [];

  applyHtmlComment(commentText: string|undefined) {
    this.description = this.description || commentText || '';
  }

  resolve(_document: Document): Element {
    const element = new Element();
    Object.assign(element, this);
    return element;
  }
}

export class Slot {
  name: string;
  range: SourceRange;

  constructor(name: string, range: SourceRange) {
    this.name = name;
    this.range = range;
  }
}

export class Element extends ElementBase implements Feature {
  tagName?: string;
  className?: string;
  superClass?: string;
  extends?: string;
  slots:
  Slot[] = [];

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
