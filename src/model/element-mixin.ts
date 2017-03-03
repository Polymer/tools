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

import {Document, ElementBase, Feature, Privacy, ScannedElementBase} from './model';

export {Visitor} from '../javascript/estree-visitor';

export class ScannedElementMixin extends ScannedElementBase {
  name: string;
  privacy: Privacy;

  resolve(_document: Document): ElementMixin {
    const element = new ElementMixin();
    Object.assign(element, this);
    return element;
  }
}

export class ElementMixin extends ElementBase implements Feature {
  name: string;
  privacy: Privacy;

  get identifiers(): Set<string> {
    return new Set([this.name]);
  }
}
