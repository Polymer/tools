import * as dom5 from 'dom5';
import {VisitorOption, traverse} from 'estraverse';
import * as estree from 'estree';

import {Attribute, Descriptor, ElementDescriptor, EventDescriptor, LiteralValue, LocationOffset, Property} from '../ast/ast';
import {SourceLocation} from '../elements-format';
import {VisitResult, Visitor} from '../javascript/estree-visitor';
import * as jsdoc from '../javascript/jsdoc';

export interface PolymerProperty extends Property {
  published?: boolean;  // what does this mean?
  notify?: boolean;
  observer?: string;
  observerNode?: estree.Expression|estree.Pattern;
  reflectToAttribute?: boolean;
  configuration?: boolean;
  getter?: boolean;
  setter?: boolean;
  function?: boolean;
}

export interface FunctionDescriptor extends PolymerProperty {
  function: boolean;  // true
  params: {name: string, type?: string}[];
  return: {type: string | null; desc: string};
}

export function isFunctionDescriptor(d: Property): d is FunctionDescriptor {
  return d['function'] === true;
}

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
  behaviors?: string[];

  demos?: {desc: string; path: string}[];
  events?: EventDescriptor[];

  abstract?: boolean;
  sourceLocation?: SourceLocation;
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
    if (prop.private || !attributeName || !prop.published) {
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
        description: `Fired when the \`${prop.name}\` property changes.`,
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
