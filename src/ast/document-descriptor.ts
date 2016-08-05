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

import {Document} from '../parser/document';
import {Descriptor} from './descriptor';
import {LocationOffset} from './inline-document-descriptor';

/**
 * The metadata for all features and elements defined in one document
 */
export class DocumentDescriptor implements Descriptor {
  document: Document<any, any>;
  dependencies: Descriptor[];
  entities: Descriptor[];
  locationOffset?: LocationOffset;

  constructor(
      document: Document<any, any>, dependencies: Descriptor[],
      entities: Descriptor[], locationOffset?: LocationOffset) {
    this.document = document;
    this.dependencies = dependencies;
    this.entities = entities;
    this.locationOffset = locationOffset;
  }

  get url() {
    return this.document.url;
  }
}
