import * as dom5 from 'dom5';
import {VisitorOption, traverse} from 'estraverse';
import * as estree from 'estree';

import {Analysis} from '../analysis';
import {Attribute, Element, Event, LiteralValue, LocationOffset, Property, ScannedAttribute, ScannedElement, ScannedEvent, ScannedFeature, ScannedProperty} from '../ast/ast';
import {SourceLocation} from '../elements-format';
import {VisitResult, Visitor} from '../javascript/estree-visitor';
import * as jsdoc from '../javascript/jsdoc';

import {ScannedBehavior} from './behavior-descriptor';

export interface BasePolymerProperty {
  published?: boolean;
  notify?: boolean;
  observer?: string;
  observerNode?: estree.Expression|estree.Pattern;
  reflectToAttribute?: boolean;
  configuration?: boolean;
  getter?: boolean;
  setter?: boolean;
  function?: boolean;
}

export interface ScannedPolymerProperty extends ScannedProperty,
                                                BasePolymerProperty {}
export interface PolymerProperty extends Property, BasePolymerProperty {}

export interface FunctionDescriptor extends ScannedPolymerProperty {
  function: boolean;  // true
  params: {name: string, type?: string}[];
  return: {type: string | null; desc: string};
}

export function isFunctionDescriptor(d: ScannedProperty):
    d is FunctionDescriptor {
  return d['function'] === true;
}

export interface Options {
  tagName?: string;
  className?: string;
  superClass?: string;
  extends?: string;
  jsdoc?: jsdoc.Annotation;
  description?: string;
  properties?: ScannedProperty[];
  attributes?: ScannedAttribute[];
  observers?: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  behaviors?: string[];

  demos?: {desc: string; path: string}[];
  events?: ScannedEvent[];

  abstract?: boolean;
  sourceLocation?: SourceLocation;
}

/**
 * The metadata for a single polymer element
 */
export class ScannedPolymerElement extends ScannedElement {
  properties: ScannedPolymerProperty[] = [];
  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[] = [];
  behaviors: string[] = [];
  // FIXME(rictic): domModule and scriptElement aren't known at a file local
  //     level. Remove them here, they should only exist on PolymerElement.
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;

  abstract?: boolean;

  constructor(options: Options) {
    super();
    Object.assign(this, options);
  }

  addProperty(prop: ScannedPolymerProperty) {
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

  resolve(analysis: Analysis): PolymerElement {
    return resolveElement(this, analysis);
  }
}

export class PolymerElement extends Element {
  properties: PolymerProperty[];

  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  behaviors: string[];
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;

  abstract?: boolean;

  emitPropertyMetadata(property: PolymerProperty) {
    const polymerMetadata: any = {};
    const polymerMetadataFields = ['notify', 'observer', 'readOnly'];
    for (const field of polymerMetadataFields) {
      if (field in property) {
        polymerMetadata[field] = property[field];
      }
    }
    return {polymer: polymerMetadata};
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

function resolveElement(
    elementDescriptor: ScannedPolymerElement,
    analysis: Analysis): PolymerElement {
  const clone: PolymerElement =
      Object.assign(new PolymerElement(), elementDescriptor);

  const behaviors = Array.from(
      getFlattenedAndResolvedBehaviors(elementDescriptor.behaviors, analysis));
  clone.properties = mergeByName(
      elementDescriptor.properties,
      behaviors.map(b => ({name: b.className, vals: b.properties})));
  clone.attributes = mergeByName(
      elementDescriptor.attributes,
      behaviors.map(b => ({name: b.className, vals: b.attributes})));
  clone.events = mergeByName(
      elementDescriptor.events,
      behaviors.map(b => ({name: b.className, vals: b.events})));

  const domModule = analysis.getDomModule(elementDescriptor.tagName);
  if (domModule) {
    clone.description = elementDescriptor.description || domModule.comment;
    clone.domModule = domModule.node;
  }

  return clone;
}

function getFlattenedAndResolvedBehaviors(
    behaviors: string[], analysis: Analysis) {
  const resolvedBehaviors = new Set<ScannedBehavior>();
  _getFlattenedAndResolvedBehaviors(behaviors, analysis, resolvedBehaviors);
  return resolvedBehaviors;
}

function _getFlattenedAndResolvedBehaviors(
    behaviors: string[], analysis: Analysis,
    resolvedBehaviors: Set<ScannedBehavior>) {
  const toLookup = behaviors.slice();
  for (let behaviorName of toLookup) {
    const behavior = analysis.getBehavior(behaviorName);
    if (!behavior) {
      throw new Error(
          `Unable to resolve behavior \`${behaviorName}\` ` +
          `Did you import it? Is it annotated with @polymerBehavior?`);
    }
    if (resolvedBehaviors.has(behavior)) {
      continue;
    }
    resolvedBehaviors.add(behavior);
    _getFlattenedAndResolvedBehaviors(
        behavior.behaviors, analysis, resolvedBehaviors);
  }
}

function mergeByName<B extends{name: string, inheritedFrom?: string}, I
                     extends{name: string}>(
    base: B[], inheritFrom: {name: string, vals: I[]}[]): B[] {
  const byName = new Map<string, B>();
  for (const initial of base) {
    byName.set(initial.name, initial);
  }
  for (const source of inheritFrom) {
    for (const item of source.vals) {
      if (!byName.has(item.name)) {
        const copy = <B><any>Object.assign({}, item);
        copy.inheritedFrom = source.name;
        byName.set(copy.name, copy);
      }
    }
  }
  return Array.from(byName.values());
}