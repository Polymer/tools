/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

export interface Document {
  kind: 'document';
  members: Array<Namespace|Class|Interface|Function>;
}

export interface Namespace {
  kind: 'namespace';
  name: string;
  members: Array<Namespace|Class|Interface|Function>;
}

export interface Class {
  kind: 'class';
  name: string;
  description: string;
  extends: string;
  properties: Property[];
  methods: Function[];
}

export interface Interface {
  kind: 'interface';
  name: string;
  description: string;
  extends: string[];
  properties: Property[];
  methods: Function[];
}

export interface Function {
  kind: 'function';
  name: string;
  description: string;
  params: Param[];
  returns: string;
}

export interface Property {
  kind: 'property';
  name: string;
  description: string;
  type: string;
}

export interface Param {
  kind: 'param';
  name: string;
  type: string;
}
