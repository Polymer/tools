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

import {Document} from './document';
import {ElementBase, ScannedElementBase} from './element-base';
import {Feature, Privacy} from './feature';
import {Reference, ScannedReference} from './reference';

export {Visitor} from '../javascript/estree-visitor';

export class ScannedElement extends ScannedElementBase {
  tagName?: string;
  className?: string;
  superClass?: ScannedReference;
  privacy: Privacy;

  /**
   * For customized built-in elements, the tagname of the superClass.
   */
  extends?: string;

  constructor() {
    super();
  }

  applyHtmlComment(commentText: string|undefined) {
    this.description = this.description || commentText || '';
  }

  resolve(document: Document): Element {
    const element = new Element();
    Object.assign(element, this);
    this.applyJsdocDemoTags(document.url);
    return element;
  }
}

export class Element extends ElementBase implements Feature {
  tagName?: string;
  className?: string;
  superClass?: Reference;
  privacy: Privacy;

  /**
   * For customized built-in elements, the tagname of the superClass.
   */
  extends?: string;

  constructor() {
    super();
  }

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
}
