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

import {Document} from '../model/model';
import {PolymerElement, ScannedPolymerElement} from './polymer-element';

export class ScannedPolymerElementMixin extends ScannedPolymerElement {
  get name() {
    return this.tagName;
  }

  resolve(_document: Document): PolymerElementMixin {
    const element = new PolymerElementMixin();
    Object.assign(element, this);
    return element;
  }
}

export class PolymerElementMixin extends PolymerElement {
  get name() {
    return this.tagName;
  }
}
