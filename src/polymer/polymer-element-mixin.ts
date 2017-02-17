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

import {Document, ElementMixin, LiteralValue, ScannedAttribute, ScannedElementMixin, ScannedEvent, ScannedProperty, SourceRange} from '../model/model';

import {PolymerExtension, ScannedPolymerExtension} from './polymer-element';

export interface Options {
  name?: string;
  jsdoc?: jsdoc.Annotation;
  description?: string;
  properties?: ScannedProperty[];
  attributes?: ScannedAttribute[];
  observers?: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  listeners?: {event: string, handler: string}[];

  demos?: {desc: string; path: string}[];
  events?: ScannedEvent[];

  abstract?: boolean;
  sourceRange?: SourceRange|undefined;
}

export class ScannedPolymerElementMixin extends ScannedPolymerExtension
(ScannedElementMixin) {
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
  }

  resolve(_document: Document): PolymerElementMixin {
    const element = new PolymerElementMixin();
    Object.assign(element, this);
    return element;
  }
}

export class PolymerElementMixin extends PolymerExtension
(ElementMixin) {
}
