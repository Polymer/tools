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
import * as estree from 'estree';

import * as jsdoc from '../javascript/jsdoc';
import {Document, Element, LiteralValue, Property, ScannedAttribute, ScannedElement, ScannedEvent, ScannedProperty, SourceRange} from '../model/model';
import {Severity, Warning} from '../warning/warning';

import {Behavior, ScannedBehaviorAssignment} from './behavior';

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

export interface ScannedFunction extends ScannedPolymerProperty {
  function: boolean;  // true
  params: {name: string, type?: string}[];
  return: {type: string | null; desc: string};
}

export function isScannedFunction(d: ScannedProperty): d is ScannedFunction {
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
  behaviors?: ScannedBehaviorAssignment[];

  demos?: {desc: string; path: string}[];
  events?: ScannedEvent[];

  abstract?: boolean;
  sourceRange: SourceRange|undefined;
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
  behaviorAssignments: ScannedBehaviorAssignment[] = [];
  // FIXME(rictic): domModule and scriptElement aren't known at a file local
  //     level. Remove them here, they should only exist on PolymerElement.
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;

  abstract?: boolean;

  constructor(options: Options) {
    super();
    // TODO(justinfagnani): fix this constructor to not be crazy, or remove
    // class altogether.
    const optionsCopy = Object.assign({}, options);
    delete optionsCopy.properties;
    Object.assign(this, optionsCopy);
    if (options.properties) {
      options.properties.forEach((p) => this.addProperty(p));
    }
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
    if (!isScannedFunction(prop)) {
      this.attributes.push({
        name: attributeName,
        sourceRange: prop.sourceRange,
        description: prop.description,
        type: prop.type,
      });
    }
    if (prop.notify) {
      this.events.push({
        name: `${attributeName}-changed`,
        description: `Fired when the \`${prop.name}\` property changes.`,
        sourceRange: prop.sourceRange,
        astNode: prop.astNode,
        warnings: []
      });
    }
  }

  resolve(document: Document): PolymerElement {
    return resolveElement(this, document);
  }
}

export class PolymerElement extends Element {
  properties: PolymerProperty[];

  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  behaviorAssignments: ScannedBehaviorAssignment[];
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;

  abstract?: boolean;

  constructor() {
    super();
    this.kinds = new Set(['element', 'polymer-element']);
    this.behaviorAssignments = [];
  }

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
    scannedElement: ScannedPolymerElement, document: Document): PolymerElement {
  // TODO: Copy over all properties better. Maybe exclude known properties not
  //   copied?
  const clone: PolymerElement =
      Object.assign(new PolymerElement(), scannedElement);

  const flatteningResult = getFlattenedAndResolvedBehaviors(
      scannedElement.behaviorAssignments, document);

  // This has the combined effects of copying the array of warnings from the
  // ScannedElement, and adding in any new ones found when resolving behaviors.
  clone.warnings = clone.warnings.concat(flatteningResult.warnings);

  const behaviors = Array.from(flatteningResult.resolvedBehaviors);
  clone.properties = mergeByName(
      scannedElement.properties,
      behaviors.map(b => ({name: b.className, vals: b.properties})));
  clone.attributes = mergeByName(
      scannedElement.attributes,
      behaviors.map(b => ({name: b.className, vals: b.attributes})));
  clone.events = mergeByName(
      scannedElement.events,
      behaviors.map(b => ({name: b.className, vals: b.events})));

  const domModule =
      document.getOnlyAtId('dom-module', scannedElement.tagName || '');
  if (domModule) {
    clone.description = scannedElement.description || domModule.comment || '';
    clone.domModule = domModule.node;
  }

  return clone;
}

export function getFlattenedAndResolvedBehaviors(
    behaviorAssignments: ScannedBehaviorAssignment[], document: Document) {
  const resolvedBehaviors = new Set<Behavior>();
  const warnings = _getFlattenedAndResolvedBehaviors(
      behaviorAssignments, document, resolvedBehaviors);
  return {resolvedBehaviors, warnings};
}

function _getFlattenedAndResolvedBehaviors(
    behaviorAssignments: ScannedBehaviorAssignment[],
    document: Document,
    resolvedBehaviors: Set<Behavior>) {
  const warnings: Warning[] = [];
  for (const behavior of behaviorAssignments) {
    const foundBehaviors = document.getById('behavior', behavior.name);
    if (foundBehaviors.size === 0) {
      warnings.push({
        message: `Unable to resolve behavior ` +
            `\`${behavior.name}\`. Did you import it? Is it annotated with ` +
            `@polymerBehavior?`,
        severity: Severity.ERROR,
        code: 'unknown-polymer-behavior',
        sourceRange: behavior.sourceRange
      });
      // Skip processing this behavior.
      continue;
    }
    if (foundBehaviors.size > 1) {
      warnings.push({
        message: `Found more than one behavior named ${behavior.name}.`,
        severity: Severity.WARNING,
        code: 'multiple-polymer-behaviors',
        sourceRange: behavior.sourceRange
      });
      // Don't skip processing this behavior, just take the most recently
      // declared instance.
    }
    const foundBehavior = Array.from(foundBehaviors)[foundBehaviors.size - 1];
    if (resolvedBehaviors.has(foundBehavior)) {
      continue;
    }
    resolvedBehaviors.add(foundBehavior);
    // Note that we don't care about warnings from transitively resolved
    // behaviors. Those should become warnings on those behaviors themselves.
    _getFlattenedAndResolvedBehaviors(
        foundBehavior.behaviorAssignments, document, resolvedBehaviors);
  }
  return warnings;
}

interface PropertyOrSimilar {
  name: string;
  inheritedFrom?: string;
}
interface HasName {
  name: string;
}
function mergeByName<Prop extends PropertyOrSimilar>(
    base: Prop[], inheritFrom: {name: string, vals: HasName[]}[]): Prop[] {
  const byName = new Map<string, Prop>();
  for (const initial of base) {
    byName.set(initial.name, initial);
  }
  for (const source of inheritFrom) {
    for (const item of source.vals) {
      if (!byName.has(item.name)) {
        const copy = <Prop><any>Object.assign({}, item);
        copy.inheritedFrom = source.name;
        byName.set(copy.name, copy);
      }
    }
  }
  return Array.from(byName.values());
}
