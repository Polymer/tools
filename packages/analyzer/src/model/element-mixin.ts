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

import {ElementBaseInit} from './element-base';
import {Document, ElementBase, Feature, ScannedElementBase} from './model';

export {Visitor} from '../javascript/estree-visitor';

export class ScannedElementMixin extends ScannedElementBase {
  readonly name: string;
  readonly abstract: boolean = false;
  constructor({name}: {name: string}) {
    super();
    this.name = name;
  }

  resolve(document: Document): ElementMixin {
    return new ElementMixin(this, document);
  }
}

export interface ElementMixinInit extends ElementBaseInit {
  name: string;
}

declare module './queryable' {
  interface FeatureKindMap {
    'element-mixin': ElementMixin;
  }
}
export class ElementMixin extends ElementBase implements Feature {
  readonly name: string;

  constructor(init: ElementMixinInit, document: Document) {
    super(init, document);
    this.kinds.add('element-mixin');
    this.name = init.name;
  }
}
