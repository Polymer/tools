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
import * as dom5 from 'dom5';
import * as estree from 'estree';

import {Annotation as JsDocAnnotation, getTag as JsDocGetTag, isAnnotationEmpty} from '../javascript/jsdoc';
import {Document, ElementMixin, LiteralValue, Method, ScannedAttribute, ScannedElementMixin, ScannedEvent, ScannedMethod, ScannedProperty, SourceRange} from '../model/model';

import {ScannedBehaviorAssignment} from './behavior';
import {addMethod, addProperty, LocalId, PolymerExtension, PolymerProperty, ScannedPolymerExtension, ScannedPolymerProperty} from './polymer-element';

export interface Options {
  name?: string;
  jsdoc?: JsDocAnnotation;
  description?: string;
  summary?: string;
  properties?: ScannedProperty[];
  methods?: ScannedMethod[];
  attributes?: ScannedAttribute[];
  observers?: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  listeners?: {event: string, handler: string}[];

  demos?: {desc: string; path: string}[];
  events?: ScannedEvent[];

  abstract?: boolean;
  sourceRange: SourceRange|undefined;
}

export class ScannedPolymerElementMixin extends ScannedElementMixin implements
    ScannedPolymerExtension {
  properties: ScannedPolymerProperty[] = [];
  methods: ScannedMethod[] = [];
  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[] = [];
  listeners: {event: string, handler: string}[] = [];
  behaviorAssignments: ScannedBehaviorAssignment[] = [];
  // FIXME(rictic): domModule and scriptElement aren't known at a file local
  //     level. Remove them here, they should only exist on PolymerElement.
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;
  // Indicates if an element is a pseudo element
  pseudo: boolean = false;
  abstract?: boolean;

  constructor(options?: Options) {
    super();
    // TODO(justinfagnani): fix this constructor to not be crazy, or remove
    // class altogether.
    const optionsCopy = Object.assign({}, options) as Options;
    delete optionsCopy.properties;
    Object.assign(this, optionsCopy);
    if (options && options.properties) {
      options.properties.forEach((p) => this.addProperty(p));
    }
    if (options && options.methods) {
      options.methods.forEach((m) => this.addMethod(m));
    }
  }

  addProperty(prop: ScannedPolymerProperty) {
    addProperty(this, prop);
  }

  addMethod(method: ScannedMethod) {
    addMethod(this, method);
  }

  resolve(_document: Document): PolymerElementMixin {
    const element = new PolymerElementMixin();
    Object.assign(element, this);

    // Mixins have their own logic to dictate when a method is private or
    // public that overrides whatever our scanner detected.
    for (const method of element.methods) {
      const hasJsDocPrivateTag = !!JsDocGetTag(method.jsdoc, 'private');
      method.private = !method.jsdoc || isAnnotationEmpty(method.jsdoc) ||
          hasJsDocPrivateTag;
    }

    return element;
  }
}

export class PolymerElementMixin extends ElementMixin implements
    PolymerExtension {
  properties: PolymerProperty[];
  methods: Method[];

  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  listeners: {event: string, handler: string}[];
  behaviorAssignments: ScannedBehaviorAssignment[];
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;
  localIds: LocalId[] = [];

  abstract?: boolean;

  constructor() {
    super();
    this.kinds = new Set(['element-mixin', 'polymer-element-mixin']);
    this.behaviorAssignments = [];
  }

  emitPropertyMetadata(property: PolymerProperty) {
    const polymerMetadata: any = {};
    const polymerMetadataFields = ['notify', 'observer', 'readOnly'];
    for (const field of polymerMetadataFields) {
      if (field in property) {
        polymerMetadata[field] = property[field];
      }
    }
    return {polymer: polymerMetadata};
  }
}
