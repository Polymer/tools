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

import {Annotation as JsDocAnnotation, getTag as JsDocGetTag, isAnnotationEmpty} from '../javascript/jsdoc';
import {Document, Element, ElementBase, LiteralValue, Method, Property, ScannedAttribute, ScannedElement, ScannedElementBase, ScannedEvent, ScannedMethod, ScannedProperty, SourceRange} from '../model/model';
import {ScannedReference} from '../model/reference';
import {Severity, Warning} from '../warning/warning';

import {Behavior, ScannedBehaviorAssignment} from './behavior';
import {PolymerElementMixin} from './polymer-element-mixin';

export interface BasePolymerProperty {
  published?: boolean;
  notify?: boolean;
  observer?: string;
  observerNode?: estree.Expression|estree.Pattern;
  reflectToAttribute?: boolean;
  configuration?: boolean;
  getter?: boolean;
  setter?: boolean;
}

export interface ScannedPolymerProperty extends ScannedProperty,
                                                BasePolymerProperty {}
export interface PolymerProperty extends Property, BasePolymerProperty {}

export class LocalId {
  name: string;
  range: SourceRange;

  constructor(name: string, range: SourceRange) {
    this.name = name;
    this.range = range;
  }
}

export interface Options {
  tagName?: string;
  className?: string;
  superClass?: ScannedReference;
  mixins?: ScannedReference[];
  extends?: string;
  jsdoc?: JsDocAnnotation;
  description?: string;
  properties?: ScannedProperty[];
  methods?: ScannedMethod[];
  attributes?: ScannedAttribute[];
  observers?: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  listeners?: {event: string, handler: string}[];
  behaviors?: ScannedBehaviorAssignment[];

  demos?: {desc: string; path: string}[];
  events?: ScannedEvent[];

  abstract?: boolean;
  sourceRange: SourceRange|undefined;
}

export interface ScannedPolymerExtension extends ScannedElementBase {
  properties: ScannedPolymerProperty[];
  methods: ScannedMethod[];
  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  listeners: {event: string, handler: string}[];
  behaviorAssignments: ScannedBehaviorAssignment[];
  // FIXME(rictic): domModule and scriptElement aren't known at a file local
  //     level. Remove them here, they should only exist on PolymerElement.
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;
  // TODO(justinfagnani): Not Polymer-specific, and hopefully not necessary
  // Indicates if an element is a pseudo element
  pseudo: boolean;
  abstract?: boolean;

  addProperty(prop: ScannedPolymerProperty): void;
}

export function addProperty(
    target: ScannedPolymerExtension, prop: ScannedPolymerProperty) {
  target.properties.push(prop);
  const attributeName = propertyToAttributeName(prop.name);
  if (prop.private || !attributeName || !prop.published) {
    return;
  }
  target.attributes.push({
    name: attributeName,
    sourceRange: prop.sourceRange,
    description: prop.description,
    type: prop.type,
    changeEvent: prop.notify ? `${attributeName}-changed` : undefined
  });
  if (prop.notify) {
    target.events.push({
      name: `${attributeName}-changed`,
      description: `Fired when the \`${prop.name}\` property changes.`,
      sourceRange: prop.sourceRange,
      astNode: prop.astNode,
      warnings: []
    });
  }
}

export function addMethod(
    target: ScannedPolymerExtension, method: ScannedMethod) {
  target.methods.push(method);
}

/**
 * The metadata for a single polymer element
 */
export class ScannedPolymerElement extends ScannedElement implements
    ScannedPolymerExtension {
  properties: ScannedPolymerProperty[] = [];
  methods: ScannedMethod[] = [];
  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[] = [];
  listeners: {event: string, handler: string}[] = [];
  behaviorAssignments: ScannedBehaviorAssignment[] = [];
  // FIXME(rictic): domModule and scriptElement aren't known at a file local
  //     level. Remove them here, they should only exist on PolymerElement.
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;
  // Indicates if an element is a pseudo element
  pseudo: boolean = false;
  abstract?: boolean;

  constructor(options?: Options) {
    super();
    // TODO(justinfagnani): fix this constructor to not be crazy, or remove
    // class altogether.
    const optionsCopy = Object.assign({}, options) as Options;
    delete optionsCopy.properties;
    delete optionsCopy.methods;
    Object.assign(this, optionsCopy);
    if (options && options.properties) {
      options.properties.forEach((p) => this.addProperty(p));
    }
    if (options && options.methods) {
      options.methods.forEach((m) => this.addMethod(m));
    }
  }

  addProperty(prop: ScannedPolymerProperty) {
    addProperty(this, prop);
  }

  addMethod(method: ScannedMethod) {
    addMethod(this, method);
  }

  resolve(document: Document): PolymerElement {
    return resolveElement(this, document);
  }
}

export interface PolymerExtension extends ElementBase {
  properties: PolymerProperty[];
  methods: Method[];

  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[];
  listeners: {event: string, handler: string}[];
  behaviorAssignments: ScannedBehaviorAssignment[];
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;
  localIds: LocalId[];

  abstract?: boolean;

  emitPropertyMetadata(property: PolymerProperty): any;
}

export class PolymerElement extends Element implements PolymerExtension {
  properties: PolymerProperty[] = [];
  methods: Method[] = [];

  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue
  }[] = [];
  listeners: {event: string, handler: string}[] = [];
  behaviorAssignments: ScannedBehaviorAssignment[] = [];
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;
  localIds: LocalId[] = [];

  abstract?: boolean;

  constructor() {
    super();
    this.kinds = new Set(['element', 'polymer-element']);
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
  const element = new PolymerElement();
  applySuperClass(element, scannedElement, document);
  applyMixins(element, scannedElement, document);
  applySelf(element, scannedElement, document);

  //
  // Behaviors
  //
  // TODO(justinfagnani): Refactor behaviors to work like superclasses and
  // mixins and be applied before own members
  const behaviorsAndWarnings =
      getBehaviors(scannedElement.behaviorAssignments, document);

  // This has the combined effects of copying the array of warnings from the
  // ScannedElement, and adding in any new ones found when resolving behaviors.
  element.warnings = element.warnings.concat(behaviorsAndWarnings.warnings);

  const behaviors = Array.from(behaviorsAndWarnings.behaviors);

  element.properties = inheritValues(
      element.properties,
      behaviors.map((b) => ({source: b.className, values: b.properties})));
  element.methods = inheritValues(
      element.methods,
      behaviors.map((b) => ({source: b.className, values: b.methods})));
  element.attributes = inheritValues(
      element.attributes,
      behaviors.map((b) => ({source: b.className, values: b.attributes})));
  element.events = inheritValues(
      element.events,
      behaviors.map((b) => ({source: b.className, values: b.events})));

  const domModule = document.getOnlyAtId(
      'dom-module',
      scannedElement.tagName || '',
      {imported: true, externalPackages: true});

  if (domModule) {
    element.description = element.description || domModule.comment || '';
    element.domModule = domModule.node;
    element.slots = domModule.slots.slice();
    element.localIds = domModule.localIds.slice();
  }

  if (scannedElement.pseudo) {
    element.kinds.add('pseudo-element');
  }

  // Elements have their own logic to dictate when a method is private or public
  // that overrides whatever our scanner detected.
  for (const method of element.methods) {
    const hasJsDocPrivateTag = !!JsDocGetTag(method.jsdoc, 'private');
    method.private =
        !method.jsdoc || isAnnotationEmpty(method.jsdoc) || hasJsDocPrivateTag;
  }

  return element;
}

/**
 * Note: mutates `element`.
 */
function inheritFrom(element: PolymerElement, superElement: PolymerExtension) {
  // TODO(justinfagnani): fixup and use inheritValues, but it has slightly odd
  // semantics currently

  for (const superProperty of superElement.properties) {
    const newProperty = Object.assign({}, superProperty);
    element.properties.push(newProperty);
  }

  for (const superMethod of superElement.methods) {
    const newMethod = Object.assign({}, superMethod);
    element.methods.push(newMethod);
  }

  for (const superAttribute of superElement.attributes) {
    const newAttribute = Object.assign({}, superAttribute);
    element.attributes.push(newAttribute);
  }

  for (const superEvent of superElement.events) {
    const newEvent = Object.assign({}, superEvent);
    element.events.push(newEvent);
  }

  // TODO(justinfagnani): slots, listeners, observers, dom-module?
  // What actually inherits?
}

function applySelf(
    element: PolymerElement,
    scannedElement: ScannedPolymerElement,
    document: Document) {
  // TODO(justinfagnani): Copy over all properties better, or have
  // PolymerElement wrap ScannedPolymerElement.
  element.abstract = scannedElement.abstract;
  element.astNode = scannedElement.astNode;
  scannedElement.attributes.forEach((o) => element.attributes.push(o));
  scannedElement.behaviorAssignments.forEach(
      (o) => element.behaviorAssignments.push(o));
  element.className = scannedElement.className;
  scannedElement.demos.forEach((o) => element.demos.push(o));
  element.description = scannedElement.description;
  element.domModule = scannedElement.domModule;
  scannedElement.events.forEach((o) => element.events.push(o));
  element.extends = scannedElement.extends;
  element.jsdoc = scannedElement.jsdoc;
  scannedElement.listeners.forEach((o) => element.listeners.push(o));
  // scannedElement.mixins.forEach(
  //     (o) => element.mixins.push(o.resolve(document)));
  scannedElement.observers.forEach((o) => element.observers.push(o));
  scannedElement.properties.forEach((o) => element.properties.push(o));
  scannedElement.methods.forEach((o) => element.methods.push(o));
  element.scriptElement = scannedElement.scriptElement;
  scannedElement.slots.forEach((o) => element.slots.push(o));
  element.sourceRange = scannedElement.sourceRange!;
  element.summary = scannedElement.summary;
  element.superClass =
      scannedElement.superClass && scannedElement.superClass.resolve(document);
  element.tagName = scannedElement.tagName;
  scannedElement.warnings.forEach((o) => element.warnings.push(o));
}

function applySuperClass(
    element: PolymerElement,
    scannedElement: ScannedElement,
    document: Document) {
  if (scannedElement.superClass &&
      scannedElement.superClass.identifier !== 'HTMLElement') {
    const superElements =
        document.getById('element', scannedElement.superClass.identifier, {
          externalPackages: true,
          imported: true,
        });
    if (superElements.size === 1) {
      const superElement = superElements.values().next().value;
      if (!superElement.kinds.has('polymer-element')) {
        element.warnings.push({
          message:
              `A Polymer element can\'t extend from a non-Polymer element: ${scannedElement
                  .superClass.identifier}`,
          severity: Severity.ERROR,
          code: 'unknown-superclass',
          sourceRange: scannedElement.superClass.sourceRange!,
        });
      } else {
        inheritFrom(element, superElement as PolymerElement);
      }
    } else {
      if (superElements.size === 0) {
        element.warnings.push({
          message: `Unable to resolve superclass ${scannedElement.superClass
                       .identifier}`,
          severity: Severity.ERROR,
          code: 'unknown-superclass',
          sourceRange: scannedElement.superClass.sourceRange!,
        });
      } else {
        element.warnings.push({
          message: `Multiple superclasses found for ${scannedElement.superClass
                       .identifier}`,
          severity: Severity.ERROR,
          code: 'unknown-superclass',
          sourceRange: scannedElement.superClass.sourceRange!,
        });
      }
    }
  }
}

function applyMixins(
    element: PolymerElement,
    scannedElement: ScannedElement,
    document: Document) {
  for (const scannedMixinReference of scannedElement.mixins) {
    const mixinReference = scannedMixinReference.resolve(document);
    const mixinId = mixinReference.identifier;
    element.mixins.push(mixinReference);
    const mixins = document.getById('element-mixin', mixinId, {
      externalPackages: true,
      imported: true,
    });
    if (mixins.size === 0) {
      element.warnings.push({
        message: `@mixes reference not found: ${mixinId}.` +
            `Did you import it? Is it annotated with @polymerMixin?`,
        severity: Severity.ERROR,
        code: 'mixes-reference-not-found',
        sourceRange: scannedMixinReference.sourceRange!,
      });
      continue;
    } else if (mixins.size > 1) {
      element.warnings.push({
        message: `@mixes reference, multiple mixins found ${mixinId}`,
        severity: Severity.ERROR,
        code: 'mixes-reference-multiple-found',
        sourceRange: scannedMixinReference.sourceRange!,
      });
      continue;
    }
    const mixin = mixins.values().next().value;
    if (!(mixin instanceof PolymerElementMixin)) {
      element.warnings.push({
        message: `@mixes reference to a non-Mixin ${mixinId}`,
        severity: Severity.ERROR,
        code: 'mixes-reference-non-mixin',
        sourceRange: scannedMixinReference.sourceRange!,
      });
      continue;
    }
    inheritFrom(element, mixin as PolymerElementMixin);
  }
}

// TODO(justinfagnani): move to Behavior
export function getBehaviors(
    behaviorAssignments: ScannedBehaviorAssignment[], document: Document) {
  const resolvedBehaviors = new Set<Behavior>();
  const warnings = _getFlattenedAndResolvedBehaviors(
      behaviorAssignments, document, resolvedBehaviors);
  return {behaviors: resolvedBehaviors, warnings};
}

function _getFlattenedAndResolvedBehaviors(
    behaviorAssignments: ScannedBehaviorAssignment[],
    document: Document,
    resolvedBehaviors: Set<Behavior>) {
  const warnings: Warning[] = [];
  for (const behavior of behaviorAssignments) {
    const foundBehaviors = document.getById(
        'behavior', behavior.name, {imported: true, externalPackages: true});
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

interface PropertyLike {
  name: string;
  inheritedFrom?: string;
}

/**
 * Merges values from `newValuesBySource` into `values`, but only if they
 * don't already exist in `values`, thus giving an inheritance-like behavior.
 *
 * TODO(justinfagnani): we should always build up an element from base-class
 * on up to get natural overriding behavior. We should also merges
 * individual definitions if that's what Polymer does. Need tests.
 */
function inheritValues<P extends PropertyLike>(
    values: P[], newValuesBySource: {source: string, values: P[]}[]): P[] {
  const valuesByName = new Map<string, P>();

  for (const initial of values) {
    valuesByName.set(initial.name, initial);
  }

  for (const source of newValuesBySource) {
    for (const value of source.values) {
      if (!valuesByName.has(value.name)) {
        const copy = Object.assign({}, value);
        // If a value is already inherited, prefer the original source
        copy.inheritedFrom = value.inheritedFrom || source.source;
        valuesByName.set(copy.name, copy);
      }
    }
  }
  return Array.from(valuesByName.values());
}
