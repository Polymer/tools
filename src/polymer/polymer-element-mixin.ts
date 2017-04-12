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

import {Annotation as JsDocAnnotation} from '../javascript/jsdoc';
import {Document, ElementMixin, Method, Privacy, ScannedElementMixin, ScannedMethod, ScannedReference, SourceRange} from '../model/model';

import {ScannedBehaviorAssignment} from './behavior';
import {getOrInferPrivacy} from './js-utils';
import {addMethod, addProperty, LocalId, Observer, PolymerExtension, PolymerProperty, ScannedPolymerExtension, ScannedPolymerProperty} from './polymer-element';

export interface Options {
  name: string;
  jsdoc: JsDocAnnotation;
  description: string;
  summary: string;
  privacy: Privacy;
  sourceRange: SourceRange;
  mixins: ScannedReference[];
  astNode: estree.Node;
}

export class ScannedPolymerElementMixin extends ScannedElementMixin implements
    ScannedPolymerExtension {
  properties: ScannedPolymerProperty[] = [];
  methods: ScannedMethod[] = [];
  observers: Observer[] = [];
  listeners: {event: string, handler: string}[] = [];
  behaviorAssignments: ScannedBehaviorAssignment[] = [];
  // FIXME(rictic): domModule and scriptElement aren't known at a file local
  //     level. Remove them here, they should only exist on PolymerElement.
  domModule: dom5.Node|undefined = undefined;
  scriptElement: dom5.Node|undefined = undefined;
  pseudo: boolean = false;
  abstract: boolean = false;

  constructor(options?: Options) {
    super();
    // TODO(justinfagnani): fix this constructor to not be crazy, or remove
    // class altogether.
    const optionsCopy = Object.assign({}, options) as Options;
    Object.assign(this, optionsCopy);
  }

  addProperty(prop: ScannedPolymerProperty) {
    addProperty(this, prop);
  }

  addMethod(method: ScannedMethod) {
    addMethod(this, method);
  }

  resolve(document: Document): PolymerElementMixin {
    const element = new PolymerElementMixin();
    Object.assign(element, this);

    for (const method of element.methods) {
      // methods are only public by default if they're documented.
      method.privacy = getOrInferPrivacy(method.name, method.jsdoc, true);
    }
    element.mixins = [];
    for (const mixin of this.mixins) {
      // TODO(rictic): we should mix these mixins into `this`. See
      // PolymerElement's logic for this.
      element.mixins.push(mixin.resolve(document));
    }

    return element;
  }
}

declare module '../model/queryable' {
  interface FeatureKindMap {
    'polymer-element-mixin': PolymerElementMixin;
  }
}
export class PolymerElementMixin extends ElementMixin implements
    PolymerExtension {
  properties: PolymerProperty[];
  methods: Method[];

  observers: Observer[];
  listeners: {event: string, handler: string}[];
  behaviorAssignments: ScannedBehaviorAssignment[] = [];
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;
  localIds: LocalId[] = [];

  kinds = new Set(['element-mixin', 'polymer-element-mixin']);

  abstract?: boolean;

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
