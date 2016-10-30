/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {Document, SourceRange} from '../model/model';
import {getFlattenedAndResolvedBehaviors, Options as ElementOptions, PolymerElement, ScannedPolymerElement} from '../polymer/polymer-element';

/**
 * A scanned behavior assignment of a Polymer element. This is only a
 * reference to the behavior and not the actual behavior definition itself.
 *
 * Example:
 *
 *   Polymer({
 *     is: 'custom-element',
 *     behaviors: [Polymer.SomeBehavior]
 *                 ^^^^^^^^^^^^^^^^^^^^
 *   });
 */
export interface ScannedBehaviorAssignment {
  name: string;
  sourceRange: SourceRange;
}

export interface Options extends ElementOptions {}

/**
 * The metadata for a Polymer behavior mixin.
 */
export class ScannedBehavior extends ScannedPolymerElement {
  tagName: undefined;
  className: string;

  constructor(options: Options) {
    super(options);
  }

  resolve(document: Document) {
    const flatteningResult =
        getFlattenedAndResolvedBehaviors(this.behaviorAssignments, document);
    const behavior = Object.assign(new Behavior(), this);
    behavior.warnings = behavior.warnings.concat(flatteningResult.warnings);
    return behavior;
  }
}

export class Behavior extends PolymerElement {
  tagName: undefined;
  className: string;
  constructor() {
    super();
    this.kinds = new Set(['behavior']);
  }

  toString() {
    return `<Behavior className=${this.className}>`;
  }
}
