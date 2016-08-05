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

import * as dom5 from 'dom5';
import {VisitorOption, traverse} from 'estraverse';
import * as estree from 'estree';

import {SourceLocation} from '../elements-format';
import {VisitResult, Visitor} from '../javascript/estree-visitor';
import * as jsdoc from '../javascript/jsdoc';
import {Document} from '../parser/document';

import {BehaviorOrName, Descriptor, EventDescriptor, LiteralValue, PropertyDescriptor} from './ast';

export {Visitor} from '../javascript/estree-visitor';

export interface Options {
  type: 'element'|'behavior';
  is?: string;

  jsdoc?: jsdoc.Annotation;
  desc?: string;
  contentHref?: string;
  properties?: PropertyDescriptor[];
  observers?: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  behaviors?: BehaviorOrName[];

  demos?: {desc: string; path: string}[];
  events?: EventDescriptor[];
  hero?: string;
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;

  abstract?: boolean;
  sourceLocation?: SourceLocation;
}

/**
 * The metadata for a single polymer element
 */
export class ElementDescriptor implements Descriptor {
  type: 'element'|'behavior';
  is: string;

  jsdoc?: jsdoc.Annotation;
  desc?: string;
  contentHref?: string;
  properties: PropertyDescriptor[] = [];
  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[] = [];
  behaviors: BehaviorOrName[] = [];

  demos: {desc: string; path: string}[] = [];
  events: EventDescriptor[] = [];
  hero?: string;
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;

  abstract?: boolean;
  sourceLocation?: SourceLocation;

  constructor(options: Options) {
    Object.assign(this, options);
  }
}
