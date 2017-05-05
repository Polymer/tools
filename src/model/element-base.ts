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

import {Class, ClassInit} from './class';
import {Privacy} from './feature';
import {Attribute, Document, Event, Feature, Method, Resolvable, ScannedAttribute, ScannedEvent, ScannedProperty, ScannedReference, SourceRange, Warning} from './model';
import {Severity} from './warning';

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
  methods: Method[];
  astNode: estree.Node|null;
  warnings: Warning[] = [];
  jsdoc?: jsdoc.Annotation;
  'slots': Slot[] = [];
  mixins: ScannedReference[] = [];
  privacy: Privacy;
  abstract: boolean = false;
  superClass?: ScannedReference = undefined;

  applyHtmlComment(commentText: string|undefined) {
    if (commentText) {
      const commentJsdoc = jsdoc.parseJsdoc(commentText);
      // Add a Warning if there are already jsdoc tags or a description for this
      // element.
      if (this.sourceRange &&
          (this.description || this.jsdoc && this.jsdoc.tags.length > 0)) {
        this.warnings.push({
          severity: Severity.WARNING,
          code: 'multiple-doc-comments',
          message:
              `${this.constructor.name} has both HTML doc and JSDoc comments.`,
          sourceRange: this.sourceRange,
        });
      }
      this.jsdoc =
          this.jsdoc ? jsdoc.join(commentJsdoc, this.jsdoc) : commentJsdoc;
      this.description = [
        commentJsdoc.description || '',
        this.description || ''
      ].join('\n\n').trim();
    }
  }

  applyJsdocDemoTags(baseUrl: string): void {
    this.demos = jsdoc.extractDemos(this.jsdoc, baseUrl);
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

export interface Demo {
  desc?: string;
  path: string;
}

export interface ElementBaseInit extends ClassInit {
  events?: Event[];
  attributes?: Attribute[];
  slots?: Slot[];
}

/**
 * Base class for Element and ElementMixin.
 */
export abstract class ElementBase extends Class implements Feature {
  attributes: Attribute[];
  events: Event[];
  'slots': Slot[] = [];

  constructor(init: ElementBaseInit, document: Document) {
    super(init, document);
    const {
      events = [],
      attributes = [],
      slots = [],
    } = init;
    this.slots = Array.from(slots);

    // Initialization of these attributes is kinda awkward, as they're part
    // of the inheritance system. See `inheritFrom` below which *may* be
    // called by our superclass, but may not be.
    this.attributes = this.attributes || [];
    this.events = this.events || [];

    this._overwriteInherited(this.attributes, attributes, undefined, true);
    this._overwriteInherited(this.events, events, undefined, true);
  }

  protected inheritFrom(superClass: Class) {
    // This may run as part of the call to the super constructor, so we need
    // to validate initialization.
    this.attributes = this.attributes || [];
    this.events = this.events || [];

    super.inheritFrom(superClass);
    if (superClass instanceof ElementBase) {
      this._overwriteInherited(
          this.attributes, superClass.attributes, superClass.name);
      this._overwriteInherited(this.events, superClass.events, superClass.name);
    }

    // TODO(justinfagnani): slots, listeners, observers, dom-module?
    // What actually inherits?
  }

  emitAttributeMetadata(_attribute: Attribute): Object {
    return {};
  }

  emitEventMetadata(_event: Event): Object {
    return {};
  }
}
