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

import * as babel from 'babel-types';
import * as dom5 from 'dom5';

import {getOrInferPrivacy} from '../javascript/esutil';
import * as jsdoc from '../javascript/jsdoc';
import {Annotation as JsDocAnnotation, Annotation} from '../javascript/jsdoc';
import {ImmutableArray} from '../model/immutable';
import {Class, Document, Element, ElementBase, LiteralValue, Privacy, Property, ScannedAttribute, ScannedElement, ScannedElementBase, ScannedEvent, ScannedMethod, ScannedProperty, Severity, SourceRange, Warning} from '../model/model';
import {ScannedReference} from '../model/reference';

import {Behavior, ScannedBehaviorAssignment} from './behavior';
import {DomModule} from './dom-module-scanner';
import {JavascriptDatabindingExpression} from './expression-scanner';

export interface BasePolymerProperty {
  published?: boolean;
  notify?: boolean;
  observer?: string;
  observerNode?: babel.Expression|babel.Pattern;
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

export function mergePropertyDeclarations(
    propA: Readonly<ScannedPolymerProperty>,
    propB: Readonly<ScannedPolymerProperty>): ScannedPolymerProperty {
  if (propA.name !== propB.name) {
    throw new Error(
        `Tried to merge properties with different names: ` +
        `'${propA.name}' and ' ${propB.name}'`);
  }
  const name = propA.name;
  const description =
      jsdoc.pickBestDescription(propA.description, propB.description);
  const jsdocAnn: Annotation = {description: description || '', tags: []};
  if (propA.jsdoc) {
    jsdocAnn.tags.push(...propA.jsdoc.tags);
  }
  if (propB.jsdoc) {
    jsdocAnn.tags.push(...propB.jsdoc.tags);
  }
  const privacy = getOrInferPrivacy(propA.name, jsdocAnn);
  const warnings = [...propA.warnings, ...propB.warnings];
  // If either are marked as readOnly, both are.
  const readOnly = propA.readOnly || propB.readOnly;

  // Handle all regular property metadata.
  const scannedRegularProperty: ScannedProperty = {
    // calculated above with care
    name,
    privacy,
    description,
    warnings,
    readOnly,
    jsdoc: jsdocAnn,

    // prefer A, but take B if there's no A.
    sourceRange: propA.sourceRange || propB.sourceRange,
    astNode: propA.astNode || propB.astNode,
    changeEvent: propA.changeEvent || propB.changeEvent,
    default: propA.default || propB.default,
    type: propA.type || propB.type,
  };
  const scannedPolymerProperty: ScannedPolymerProperty = scannedRegularProperty;

  // For the scannedPolymerProperty keys, set them if they're there
  const keys = [
    'published' as 'published',
    'notify' as 'notify',
    'observer' as 'observer',
    'observerNode' as 'observerNode',
    'observerExpression' as 'observerExpression',
    'reflectToAttribute' as 'reflectToAttribute',
    'computedExpression' as 'computedExpression'
  ];
  for (const key of keys) {
    if (propA[key] || propB[key]) {
      scannedPolymerProperty[key] = propA[key] || propB[key];
    }
  }
  if (propA.published || propB.published) {
    scannedPolymerProperty.published = propA.published || propB.published;
  }
  return scannedPolymerProperty;
}

export class LocalId {
  name: string;
  range: SourceRange;

  constructor(name: string, range: SourceRange) {
    this.name = name;
    this.range = range;
  }
}

export interface Observer {
  javascriptNode: babel.Expression|babel.SpreadElement;
  expression: LiteralValue;
  parsedExpression: JavascriptDatabindingExpression|undefined;
}

export interface Options {
  tagName: string|undefined;
  className: string|undefined;
  superClass: ScannedReference|undefined;
  mixins: ScannedReference[];
  extends: string|undefined;
  jsdoc: JsDocAnnotation;
  description: string|undefined;
  properties: ScannedProperty[];
  methods: Map<string, ScannedMethod>;
  staticMethods: Map<string, ScannedMethod>;
  attributes: Map<string, ScannedAttribute>;
  observers: Observer[];
  listeners: {event: string, handler: string}[];
  behaviors: ScannedBehaviorAssignment[];

  events: Map<string, ScannedEvent>;

  abstract: boolean;
  privacy: Privacy;
  astNode: any;
  sourceRange: SourceRange|undefined;
}

export interface ScannedPolymerExtension extends ScannedElementBase {
  properties: Map<string, ScannedPolymerProperty>;
  methods: Map<string, ScannedMethod>;
  observers: Observer[];
  listeners: {event: string, handler: string}[];
  behaviorAssignments: ScannedBehaviorAssignment[];
  // TODO(justinfagnani): Not Polymer-specific, and hopefully not necessary
  pseudo: boolean;

  addProperty(prop: ScannedPolymerProperty): void;
}

export function addProperty(
    target: ScannedPolymerExtension, prop: ScannedPolymerProperty) {
  const existingProp = target.properties.get(prop.name);
  if (existingProp) {
    prop = mergePropertyDeclarations(existingProp, prop);
  }
  target.properties.set(prop.name, prop);
  const attributeName = propertyToAttributeName(prop.name);
  // Don't produce attributes or events for nonpublic properties, properties
  // that aren't in Polymer's `properties` block (i.e. not published),
  // or properties whose names can't be converted into attribute names.
  if ((prop.privacy && prop.privacy !== 'public') || !attributeName ||
      !prop.published) {
    return;
  }
  target.attributes.set(attributeName, {
    name: attributeName,
    sourceRange: prop.sourceRange,
    description: prop.description,
    type: prop.type,
    changeEvent: prop.notify ? `${attributeName}-changed` : undefined
  });
  if (prop.notify) {
    const name = `${attributeName}-changed`;
    target.events.set(name, {
      name,
      description: `Fired when the \`${prop.name}\` property changes.`,
      sourceRange: prop.sourceRange,
      astNode: prop.astNode,
      warnings: [],
      params: []
    });
  }
}

export function addMethod(
    target: ScannedPolymerExtension, method: ScannedMethod) {
  target.methods.set(method.name, method);
}

/**
 * The metadata for a single polymer element
 */
export class ScannedPolymerElement extends ScannedElement implements
    ScannedPolymerExtension {
  properties = new Map<string, ScannedPolymerProperty>();
  methods = new Map<string, ScannedMethod>();
  observers: Observer[] = [];
  listeners: {event: string, handler: string}[] = [];
  behaviorAssignments: ScannedBehaviorAssignment[] = [];
  // Indicates if an element is a pseudo element
  pseudo: boolean = false;
  abstract: boolean = false;

  constructor(options: Options) {
    super();
    this.tagName = options.tagName;
    this.className = options.className;
    this.superClass = options.superClass;
    this.mixins = options.mixins;
    this.extends = options.extends;
    this.jsdoc = options.jsdoc;
    this.description = options.description || '';
    this.attributes = options.attributes;
    this.observers = options.observers;
    this.listeners = options.listeners;
    this.behaviorAssignments = options.behaviors;
    this.events = options.events;
    this.abstract = options.abstract;
    this.privacy = options.privacy;
    this.astNode = options.astNode;
    this.sourceRange = options.sourceRange;

    if (options.properties) {
      options.properties.forEach((p) => this.addProperty(p));
    }
    if (options.methods) {
      options.methods.forEach((m) => this.addMethod(m));
    }
    const summaryTag = jsdoc.getTag(this.jsdoc, 'summary');
    this.summary =
        (summaryTag !== undefined && summaryTag.description != null) ?
        summaryTag.description :
        '';
  }

  addProperty(prop: ScannedPolymerProperty) {
    addProperty(this, prop);
  }

  addMethod(method: ScannedMethod) {
    addMethod(this, method);
  }

  resolve(document: Document): PolymerElement {
    return new PolymerElement(this, document);
  }
}

export interface PolymerExtension extends ElementBase {
  properties: Map<string, PolymerProperty>;

  observers: ImmutableArray < {
    javascriptNode: babel.Expression|babel.SpreadElement,
        expression: LiteralValue,
        parsedExpression: JavascriptDatabindingExpression|undefined;
  }
  > ;
  listeners: ImmutableArray<{event: string, handler: string}>;
  behaviorAssignments: ImmutableArray<ScannedBehaviorAssignment>;
  localIds: ImmutableArray<LocalId>;

  emitPropertyMetadata(property: PolymerProperty): any;
}

declare module '../model/queryable' {
  interface FeatureKindMap {
    'polymer-element': PolymerElement;
    'pseudo-element': Element;
  }
}

export class PolymerElement extends Element implements PolymerExtension {
  readonly properties: Map<string, PolymerProperty>;
  readonly observers: ImmutableArray<Observer> = [];
  readonly listeners: ImmutableArray<{event: string, handler: string}> = [];
  readonly behaviorAssignments: ImmutableArray<ScannedBehaviorAssignment> = [];
  readonly domModule?: dom5.Node;
  readonly localIds: ImmutableArray<LocalId> = [];

  constructor(scannedElement: ScannedPolymerElement, document: Document) {
    super(scannedElement, document);
    this.kinds.add('polymer-element');

    this.observers = Array.from(scannedElement.observers);
    this.listeners = Array.from(scannedElement.listeners);
    this.behaviorAssignments = Array.from(scannedElement.behaviorAssignments);

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
      this.domModule = domModule.node;
      this.slots = this.slots.concat(domModule.slots);
      this.localIds = domModule.localIds.slice();
      // If there's a domModule and it's got a comment, that comment documents
      // this element too. Extract its description and @demo annotations.
      if (domModule.comment) {
        const domModuleJsdoc = jsdoc.parseJsdoc(domModule.comment);
        this.demos = [...jsdoc.extractDemos(domModuleJsdoc), ...this.demos];
        if (domModuleJsdoc.description) {
          this.description =
              (domModuleJsdoc.description + '\n\n' + this.description).trim();
        }
      }
    }

    if (scannedElement.pseudo) {
      this.kinds.add('pseudo-element');
    }
  }

  emitPropertyMetadata(property: PolymerProperty) {
    const polymerMetadata:
        {notify?: boolean, observer?: string, readOnly?: boolean} = {};
    const polymerMetadataFields: Array<keyof typeof polymerMetadata> =
        ['notify', 'observer', 'readOnly'];
    for (const field of polymerMetadataFields) {
      if (field in property) {
        polymerMetadata[field] = property[field];
      }
    }
    return {polymer: polymerMetadata};
  }

  protected _getSuperclassAndMixins(
      document: Document, init: ScannedPolymerElement): Class[] {
    const prototypeChain = super._getSuperclassAndMixins(document, init);

    const {warnings, behaviors} =
        getBehaviors(init.behaviorAssignments, document);

    this.warnings.push(...warnings);
    prototypeChain.push(...behaviors);
    return prototypeChain;
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

export function getBehaviors(
    behaviorAssignments: ImmutableArray<ScannedBehaviorAssignment>,
    document: Document) {
  const warnings: Warning[] = [];
  const behaviors: Behavior[] = [];
  for (const behavior of behaviorAssignments) {
    const foundBehaviors = document.getFeatures({
      kind: 'behavior',
      id: behavior.name,
      imported: true,
      externalPackages: true
    });
    if (foundBehaviors.size === 0) {
      warnings.push(new Warning({
        message: `Unable to resolve behavior ` +
            `\`${behavior.name}\`. Did you import it? Is it annotated with ` +
            `@polymerBehavior?`,
        severity: Severity.WARNING,
        code: 'unknown-polymer-behavior',
        sourceRange: behavior.sourceRange,
        parsedDocument: document.parsedDocument
      }));
      // Skip processing this behavior.
      continue;
    }
    if (foundBehaviors.size > 1) {
      warnings.push(new Warning({
        message: `Found more than one behavior named ${behavior.name}.`,
        severity: Severity.WARNING,
        code: 'multiple-polymer-behaviors',
        sourceRange: behavior.sourceRange,
        parsedDocument: document.parsedDocument
      }));
      // Don't skip processing this behavior, just take the most recently
      // declared instance.
    }
    const foundBehavior = Array.from(foundBehaviors)[foundBehaviors.size - 1];
    behaviors.push(foundBehavior);
  }
  return {warnings, behaviors};
}
