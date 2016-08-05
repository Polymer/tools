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

import * as estree from 'estree';

import {SourceLocation} from '../elements-format';

import {BehaviorOrName} from './behavior-descriptor';
import {Descriptor, LiteralValue} from './descriptor';


// TODO(justinfagnani): Rename, this name clashes with ES6's PropertyDescriptor
export interface PropertyDescriptor extends Descriptor {
  name: string;
  type: string;
  desc: string;
  javascriptNode: estree.Node;
  params?: {name: string}[];
  published?: boolean;
  notify?: LiteralValue;
  observer?: LiteralValue;
  observerNode?: estree.Expression;
  readOnly?: LiteralValue;
  reflectToAttribute?: LiteralValue;
  'default'?: LiteralValue;
  private?: boolean;
  configuration?: boolean;
  getter?: boolean;
  setter?: boolean;
  sourceLocation?: SourceLocation;

  __fromBehavior?: BehaviorOrName;
}
