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

import {BehaviorOrName, Descriptor, EventDescriptor, LiteralValue, LocationOffset, correctSourceLocation, isFunctionDescriptor} from './ast';

export {Visitor} from '../javascript/estree-visitor';

export interface Options {
  tagName?: string;
  className?: string;
  superClass?: string;
  extends?: string;
  jsdoc?: jsdoc.Annotation;
  description?: string;
  properties?: Property[];
  attributes?: Attribute[];
  observers?: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  behaviors?: BehaviorOrName[];

  demos?: {desc: string; path: string}[];
  events?: EventDescriptor[];

  domModule?: dom5.Node;
  scriptElement?: dom5.Node;

  abstract?: boolean;
  sourceLocation?: SourceLocation;
}

export interface Attribute {
  name: string;
  sourceLocation: SourceLocation;
  description?: string;
  type?: string;
}

export interface Property {
  name: string;
  type?: string;
  description?: string;
  jsdoc?: jsdoc.Annotation;
  private?: boolean;
  'default'?: string;
  readOnly?: boolean;
  javascriptNode?: estree.Node;
  sourceLocation: SourceLocation;
}

export interface PolymerProperty extends Property {
  published?: boolean;
  notify?: boolean;
  observer?: string;
  observerNode?: estree.Expression|estree.Pattern;
  reflectToAttribute?: boolean;
  configuration?: boolean;
  getter?: boolean;
  setter?: boolean;
}

export class ElementDescriptor implements Descriptor {
  tagName?: string;
  className?: string;
  superClass?: string;
  extends?: string;
  properties: Property[] = [];
  attributes: Attribute[] = [];
  description = '';
  demos: {desc?: string; path: string}[] = [];
  events: EventDescriptor[] = [];
  sourceLocation: SourceLocation;

  jsdoc?: jsdoc.Annotation;

  applyLocationOffset(locationOffset?: LocationOffset) {
    if (!locationOffset) {
      return;
    }
    this.sourceLocation =
        correctSourceLocation(this.sourceLocation, locationOffset);
    for (const prop of this.properties) {
      prop.sourceLocation =
          correctSourceLocation(prop.sourceLocation, locationOffset);
    }
    for (const attribute of this.attributes) {
      attribute.sourceLocation =
          correctSourceLocation(attribute.sourceLocation, locationOffset);
    }
  }
}
/**
 * The metadata for a single polymer element
 */
export class PolymerElementDescriptor extends ElementDescriptor {
  properties: PolymerProperty[] = [];
  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[] = [];
  behaviors: string[] = [];
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;

  abstract?: boolean;

  constructor(options: Options) {
    super();
    Object.assign(this, options);
  }

  addProperty(prop: PolymerProperty) {
    if (prop.name.startsWith('_') || prop.name.endsWith('_')) {
      prop.private = true;
    }
    this.properties.push(prop);
    const attributeName = propertyToAttributeName(prop.name);
    if (prop.private || !attributeName) {
      return;
    }
    if (!isFunctionDescriptor(prop)) {
      this.attributes.push({
        name: attributeName,
        sourceLocation: prop.sourceLocation,
        description: prop.description,
        type: prop.type,
      });
    }
    if (prop.notify) {
      this.events.push({
        name: `${attributeName}-changed`,
        description: `Fired when ${attributeName} changes.`,
      });
    }
  }
}


/**
 * Implements Polymer core's translation of property names to attribute names.
 *
 * Returns null if the property name cannot be so converted.
 */
function propertyToAttributeName(propertyName: string): string|null {
  // Polymer core will not map a property name that starts with an uppercase
  // character onto an attribute.
  if (propertyName[0].toUpperCase() === propertyName[0]) {
    return null;
  }
  return propertyName.replace(
      /([A-Z])/g, (_: string, c1: string) => `-${c1.toLowerCase()}`);
}
