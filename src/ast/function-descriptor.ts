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

import {PolymerProperty} from '../polymer/element-descriptor';

import {Property} from './property-descriptor';

export interface FunctionDescriptor extends PolymerProperty {
  function: boolean;  // true
  params: {name: string, type?: string}[];
  return: {type: string | null; desc: string};
}

export function isFunctionDescriptor(d: Property): d is FunctionDescriptor {
  return d['function'] === true;
}