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

import {Attribute, Event} from '../index';
import * as jsdoc from '../javascript/jsdoc';
import {Annotation as JsDocAnnotation} from '../javascript/jsdoc';
import {Document, Element, ElementBase, LiteralValue, Method, Privacy, Property, ScannedAttribute, ScannedElement, ScannedElementBase, ScannedEvent, ScannedMethod, ScannedProperty, Severity, SourceRange, Warning} from '../model/model';
import {ScannedReference} from '../model/reference';

import {Behavior, ScannedBehaviorAssignment} from './behavior';
import {DomModule} from './dom-module-scanner';
import {JavascriptDatabindingExpression} from './expression-scanner';
import {getOrInferPrivacy} from './js-utils';
import {PolymerElementMixin} from './polymer-element-mixin';

export interface BasePolymerProperty {
  published?: boolean;
  notify?: boolean;
  observer?: string;
  observerNode?: estree.Expression|estree.Pattern;
  observerExpression?: JavascriptDatabindingExpression;
  reflectToAttribute?: boolean;
  computedExpression?: JavascriptDatabindingExpression;
  /**
   * True if the property is part of Polymer's element configuration syntax.
   *
   * e.g. 'properties', 'is', 'extends', etc
   */
  isConfiguration?: boolean;
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

export interface Observer {
  javascriptNode: estree.Expression|estree.SpreadElement;
  expression: LiteralValue;
  parsedExpression: JavascriptDatabindingExpression|undefined;
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
  observers?: Observer[];
  listeners?: {event: string, handler: string}[];
  behaviors?: ScannedBehaviorAssignment[];

  demos?: {desc: string; path: string}[];
  events?: ScannedEvent[];

  abstract?: boolean;
  privacy: Privacy;
  astNode: any;
  sourceRange: SourceRange|undefined;
}

export interface ScannedPolymerExtension extends ScannedElementBase {
  properties: ScannedPolymerProperty[];
  methods: ScannedMethod[];
  observers: Observer[];
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
  // Don't produce attributes or events for nonpublic properties, properties
  // that aren't in Polymer's `properties` block (i.e. not published),
  // or properties whose names can't be converted into attribute names.
  if ((prop.privacy && prop.privacy !== 'public') || !attributeName ||
      !prop.published) {
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
  observers: Observer[] = [];
  listeners: {event: string, handler: string}[] = [];
  behaviorAssignments: ScannedBehaviorAssignment[] = [];
  // FIXME(rictic): domModule and scriptElement aren't known at a file local
  //     level. Remove them here, they should only exist on PolymerElement.
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;
  // Indicates if an element is a pseudo element
  pseudo: boolean = false;
  abstract?: boolean;

  constructor(options: Options) {
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
    if (this.jsdoc) {
      this.summary = this.summary ||
          jsdoc.getTag(this.jsdoc, 'summary', 'description') || '';
    }
  }

  addProperty(prop: ScannedPolymerProperty) {
    addProperty(this, prop);
  }

  addMethod(method: ScannedMethod) {
    addMethod(this, method);
  }

  resolve(document: Document): PolymerElement {
    this.applyJsdocDemoTags(document.url);
    return resolveElement(this, document);
  }
}

export interface PolymerExtension extends ElementBase {
  properties: PolymerProperty[];
  methods: Method[];

  observers: {
    javascriptNode: estree.Expression | estree.SpreadElement,
    expression: LiteralValue,
    parsedExpression: JavascriptDatabindingExpression|undefined;
  }[];
  listeners: {event: string, handler: string}[];
  behaviorAssignments: ScannedBehaviorAssignment[];
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;
  localIds: LocalId[];

  abstract?: boolean;

  emitPropertyMetadata(property: PolymerProperty): any;
}

declare module '../model/queryable' {
  interface FeatureKindMap {
    'polymer-element': PolymerElement;
    'pseudo-element': Element;
  }
}

export class PolymerElement extends Element implements PolymerExtension {
  properties: PolymerProperty[] = [];
  methods: Method[] = [];

  observers: Observer[] = [];
  listeners: {event: string, handler: string}[] = [];
  behaviorAssignments: ScannedBehaviorAssignment[] = [];
  domModule?: dom5.Node;
  scriptElement?: dom5.Node;
  localIds: LocalId[] = [];

  abstract?: boolean;

  kinds = new Set(['element', 'polymer-element']);

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
  element.privacy = scannedElement.privacy;
  applySuperClass(element, scannedElement, document);
  applyMixins(element, scannedElement, document);

  //
  // Behaviors
  //
  // TODO(justinfagnani): Refactor behaviors to work like superclasses and
  // mixins and be applied before own members
  const {warnings, behaviors} =
      getBehaviors(scannedElement.behaviorAssignments, document);

  // This has the combined effects of copying the array of warnings from the
  // ScannedElement, and adding in any new ones found when resolving behaviors.
  element.warnings = element.warnings.concat(warnings);

  for (const behavior of behaviors) {
    inheritFrom(element, behavior);
  }

  applySelf(element, scannedElement, document);

  const domModules = scannedElement.tagName == null ?
      new Set<DomModule>() :
      document.getFeatures({
        kind: 'dom-module',
        id: scannedElement.tagName,
        imported: true,
        externalPackages: true
      });
  let domModule = undefined;
  if (domModules.size === 1) {
    // TODO(rictic): warn if this isn't true.
    domModule = domModules.values().next().value;
  }


  if (domModule) {
    element.description = element.description || domModule.comment || '';
    element.domModule = domModule.node;
    element.slots = domModule.slots.slice();
    element.localIds = domModule.localIds.slice();
  }

  if (scannedElement.pseudo) {
    element.kinds.add('pseudo-element');
  }

  for (const method of element.methods) {
    // methods are only public by default if they're documented.
    method.privacy = getOrInferPrivacy(method.name, method.jsdoc, true);
  }

  return element;
}

/**
 * Note: mutates `element`.
 */
function inheritFrom(element: PolymerElement, superElement: PolymerExtension) {
  // TODO(rictic): we don't inherit private members, but we should check for
  //     clashes between them, as that can cause issues at runtime.

  const superName = getSuperName(superElement);
  _overwriteInherited(
      element.properties,
      superElement.properties,
      superName,
      element.warnings,
      element.sourceRange);
  _overwriteInherited(
      element.methods,
      superElement.methods,
      superName,
      element.warnings,
      element.sourceRange);
  _overwriteInherited(
      element.attributes,
      superElement.attributes,
      superName,
      element.warnings,
      element.sourceRange);
  _overwriteInherited(
      element.events,
      superElement.events,
      superName,
      element.warnings,
      element.sourceRange);

  // TODO(justinfagnani): slots, listeners, observers, dom-module?
  // What actually inherits?
}

export interface PropertyLike {
  name: string;
  sourceRange?: SourceRange;
  inheritedFrom?: string;
  privacy?: Privacy;
}

/**
 * This method is applied to an array of members to overwrite members lower in
 * the prototype graph (closer to Object) with members higher up (closer to the
 * final class we're constructing).
 *
 * @param . existing The array of members so far. N.B. *This param is mutated.*
 * @param . overriding The array of members from this new, higher prototype in
 *   the graph
 * @param . overridingClassName The name of the prototype whose members are
 *   being applied over the existing ones. Should be `undefined` when
 *   applyingSelf is true
 * @param . warnings Place to put generated warnings.
 * @param . sourceRange A source range to use for warnings when the inheritance
 *   goes wrong but there's no more specific source range.
 * @param . applyingSelf True on the last call to this method, when we're
 *   applying the class's own local members.
 */
export function _overwriteInherited<P extends PropertyLike>(
    existing: P[],
    overriding: P[],
    overridingClassName: string | undefined,
    warnings: Warning[],
    sourceRange: SourceRange,
    applyingSelf = false) {
  // This exists to treat the arrays as maps.
  // TODO(rictic): convert these arrays to maps.
  const existingIndexByName =
      new Map(existing.map((e, idx) => [e.name, idx] as [string, number]));
  for (const overridingVal of overriding) {
    const newVal = Object.assign({}, overridingVal, {
      inheritedFrom: overridingVal['inheritedFrom'] || overridingClassName
    });
    if (existingIndexByName.has(overridingVal.name)) {
      /**
       * TODO(rictic): if existingVal.privacy is protected, newVal should be
       *    protected unless an explicit privacy was specified.
       *    https://github.com/Polymer/polymer-analyzer/issues/631
       */
      const existingIndex = existingIndexByName.get(overridingVal.name)!;
      const existingValue = existing[existingIndex]!;
      if (existingValue.privacy === 'private') {
        let warningSourceRange = sourceRange;
        if (applyingSelf) {
          warningSourceRange = newVal.sourceRange || sourceRange;
        }
        warnings.push({
          code: 'overriding-private',
          message: `Overriding private member '${overridingVal.name}' ` +
              `inherited from ${existingValue.inheritedFrom || 'parent'}`,
          sourceRange: warningSourceRange,
          severity: Severity.WARNING
        });
      }
      existing[existingIndex] = newVal;
      continue;
    }
    existing.push(newVal);
  }
}

function applySelf(
    element: PolymerElement,
    scannedElement: ScannedPolymerElement,
    document: Document) {
  // TODO(justinfagnani): Copy over all properties better, or have
  // PolymerElement wrap ScannedPolymerElement.
  element.abstract = scannedElement.abstract;
  element.astNode = scannedElement.astNode;
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
  scannedElement.observers.forEach((o) => element.observers.push(o));
  element.scriptElement = scannedElement.scriptElement;
  scannedElement.slots.forEach((o) => element.slots.push(o));
  element.sourceRange = scannedElement.sourceRange!;
  element.summary = scannedElement.summary;
  element.superClass =
      scannedElement.superClass && scannedElement.superClass.resolve(document);
  element.tagName = scannedElement.tagName;
  scannedElement.warnings.forEach((o) => element.warnings.push(o));

  _overwriteInherited(
      element.properties,
      scannedElement.properties as PolymerProperty[],
      undefined,
      element.warnings,
      element.sourceRange,
      true);
  _overwriteInherited(
      element.attributes,
      scannedElement.attributes as Attribute[],
      undefined,
      element.warnings,
      element.sourceRange,
      true);
  _overwriteInherited(
      element.methods,
      scannedElement.methods as Method[],
      undefined,
      element.warnings,
      element.sourceRange,
      true);
  _overwriteInherited(
      element.events,
      scannedElement.events as Event[],
      undefined,
      element.warnings,
      element.sourceRange,
      true);
}

function applySuperClass(
    element: PolymerElement,
    scannedElement: ScannedElement,
    document: Document) {
  if (scannedElement.superClass &&
      scannedElement.superClass.identifier !== 'HTMLElement') {
    const superElements = document.getFeatures({
      kind: 'element',
      id: scannedElement.superClass.identifier,
      externalPackages: true,
      imported: true,
    });
    if (superElements.size === 1) {
      const superElement = superElements.values().next().value;
      if (!superElement.kinds.has('polymer-element')) {
        element.warnings.push({
          message:
              `A Polymer element can\'t extend from a non-Polymer element: ` +
              `${scannedElement.superClass.identifier}`,
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
          message: `Unable to resolve superclass ${
                                                   scannedElement.superClass
                                                       .identifier
                                                 }`,
          severity: Severity.ERROR,
          code: 'unknown-superclass',
          sourceRange: scannedElement.superClass.sourceRange!,
        });
      } else {
        element.warnings.push({
          message: `Multiple superclasses found for ${
                                                      scannedElement.superClass
                                                          .identifier
                                                    }`,
          severity: Severity.ERROR,
          code: 'unknown-superclass',
          sourceRange: scannedElement.superClass.sourceRange!,
        });
      }
    }
  }
}

export function applyMixins(
    element: PolymerElement,
    scannedElement: ScannedElement,
    document: Document) {
  for (const scannedMixinReference of scannedElement.mixins) {
    const mixinReference = scannedMixinReference.resolve(document);
    const mixinId = mixinReference.identifier;
    element.mixins.push(mixinReference);
    const mixins = document.getFeatures({
      kind: 'element-mixin',
      id: mixinId,
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
    const foundBehaviors = document.getFeatures({
      kind: 'behavior',
      id: behavior.name,
      imported: true,
      externalPackages: true
    });
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

function getSuperName(superElement: PolymerExtension|
                      ScannedPolymerElement): string|undefined {
  // TODO(justinfagnani): Mixins, elements and functions should all have a
  // name property.
  if (superElement instanceof PolymerElement ||
      superElement instanceof ScannedPolymerElement) {
    return superElement.className;
  } else if (superElement instanceof PolymerElementMixin) {
    return superElement.name;
  }
}
