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
import * as url from 'url';
import * as jsdoc from '../javascript/jsdoc';

import {Attribute, Document, Event, Feature, Method, Property, Reference, Resolvable, ScannedAttribute, ScannedEvent, ScannedProperty, ScannedReference, SourceRange, Warning} from './model';

export {Visitor} from '../javascript/estree-visitor';

/**
 * Base class for ScannedElement and ScannedElementMixin.
 */
export abstract class ScannedElementBase implements Resolvable {
  properties: ScannedProperty[] = [];
  attributes: ScannedAttribute[] = [];
  description = '';
  summary = '';
  demos: {desc?: string; path: string}[] = [];
  events: ScannedEvent[] = [];
  sourceRange: SourceRange|undefined;
  astNode: estree.Node|null;
  warnings: Warning[] = [];
  jsdoc?: jsdoc.Annotation;
  'slots': Slot[] = [];
  mixins: ScannedReference[] = [];

  applyHtmlComment(commentText: string|undefined) {
    this.description = this.description || commentText || '';
  }

  applyJsdocDemoTags(baseUrl: string): void {
    if (!this.jsdoc || !this.jsdoc.tags) {
      return;
    }
    this.jsdoc.tags.filter((tag) => tag.tag === 'demo' && tag.name)
        .forEach((tag) => {
          this.demos.push({
            desc: tag.description || undefined,
            path: url.resolve(baseUrl, tag.name!)
          });
        });
  }

  resolve(_document: Document): any {
    throw new Error('abstract');
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

/**
 * Base class for Element and ElementMixin.
 */
export abstract class ElementBase implements Feature {
  properties: Property[] = [];
  attributes: Attribute[] = [];
  methods: Method[] = [];
  description = '';
  summary = '';
  demos: {desc?: string; path: string}[] = [];
  events: Event[] = [];
  sourceRange: SourceRange;
  jsdoc?: jsdoc.Annotation;
  astNode: estree.Node|null;
  abstract kinds: Set<string>;
  warnings: Warning[] = [];
  'slots': Slot[] = [];

  /**
   * Mixins that this class declares with `@mixes`.
   *
   * Mixins are applied linearly after the superclass, in order from first
   * to last. Mixins that compose other mixins will be flattened into a
   * single list. A mixin can be applied more than once, each time its
   * members override those before it in the prototype chain.
   */
  mixins: Reference[] = [];

  get identifiers(): Set<string> {
    throw new Error('abstract');
  }

  emitMetadata(): Object {
    return {};
  }

  emitPropertyMetadata(_property: Property): Object {
    return {};
  }

  emitAttributeMetadata(_attribute: Attribute): Object {
    return {};
  }

  emitMethodMetadata(_property: Method): Object {
    return {};
  }

  emitEventMetadata(_event: Event): Object {
    return {};
  }
}
