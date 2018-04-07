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

import * as babel from '@babel/types';
import * as dom5 from 'dom5/lib/index-next';
import * as parse5 from 'parse5';

import {getOrInferPrivacy} from '../javascript/esutil';
import * as jsdoc from '../javascript/jsdoc';
import {Annotation as JsDocAnnotation, Annotation} from '../javascript/jsdoc';
import {ImmutableArray} from '../model/immutable';
import {Class, Document, Element, ElementBase, LiteralValue, Privacy, Property, ScannedAttribute, ScannedElement, ScannedElementBase, ScannedEvent, ScannedMethod, ScannedProperty, SourceRange, Warning} from '../model/model';
import {ScannedReference} from '../model/reference';

import {Behavior} from './behavior';
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

  /**
   * Constructor used when deserializing this property from an attribute.
   */
  attributeType?: string;
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
  nodeName: string;

  constructor(name: string, range: SourceRange, nodeName: string) {
    this.name = name;
    this.range = range;
    this.nodeName = nodeName;
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
  superClass: ScannedReference<'class'>|undefined;
  mixins: ScannedReference<'element-mixin'>[];
  extends: string|undefined;
  jsdoc: JsDocAnnotation;
  description: string|undefined;
  properties: ScannedProperty[];
  methods: Map<string, ScannedMethod>;
  staticMethods: Map<string, ScannedMethod>;
  attributes: Map<string, ScannedAttribute>;
  observers: Observer[];
  listeners: {event: string, handler: string}[];
  behaviors: ScannedReference<'behavior'>[];

  events: Map<string, ScannedEvent>;

  abstract: boolean;
  privacy: Privacy;
  // TODO(rictic): make this AstNodeWithLanguage
  astNode: any;
  statementAst: babel.Statement|undefined;
  sourceRange: SourceRange|undefined;
}

export interface ScannedPolymerExtension extends ScannedElementBase {
  properties: Map<string, ScannedPolymerProperty>;
  methods: Map<string, ScannedMethod>;
  observers: Observer[];
  listeners: {event: string, handler: string}[];
  behaviorAssignments: ScannedReference<'behavior'>[];
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

export function addStaticMethod(
    target: ScannedPolymerExtension, method: ScannedMethod) {
  target.staticMethods.set(method.name, method);
}

/**
 * The metadata for a single polymer element
 */
export class ScannedPolymerElement extends ScannedElement implements
    ScannedPolymerExtension {
  properties = new Map<string, ScannedPolymerProperty>();
  methods = new Map<string, ScannedMethod>();
  staticMethods = new Map<string, ScannedMethod>();
  observers: Observer[] = [];
  listeners: {event: string, handler: string}[] = [];
  behaviorAssignments: ScannedReference<'behavior'>[] = [];
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
    this.statementAst = options.statementAst;
    this.sourceRange = options.sourceRange;

    if (options.properties) {
      options.properties.forEach((p) => this.addProperty(p));
    }
    if (options.methods) {
      options.methods.forEach((m) => this.addMethod(m));
    }
    if (options.staticMethods) {
      options.staticMethods.forEach((m) => this.addStaticMethod(m));
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

  addStaticMethod(method: ScannedMethod) {
    addStaticMethod(this, method);
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
  behaviorAssignments: ImmutableArray<ScannedReference<'behavior'>>;
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
  // This property is assigned in the super class. We just refine its type here.
  readonly properties!: Map<string, PolymerProperty>;
  readonly observers: ImmutableArray<Observer> = [];
  readonly listeners: ImmutableArray<{event: string, handler: string}> = [];
  readonly behaviorAssignments: ImmutableArray<ScannedReference<'behavior'>> =
      [];
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
      const template =
          dom5.query(domModule.node, dom5.predicates.hasTagName('template'));
      if (template) {
        this.template = {
          kind: 'polymer-databinding',
          contents: parse5.treeAdapters.default.getTemplateContent(template)
        };
      }
    }

    if (scannedElement.pseudo) {
      this.kinds.add('pseudo-element');
    }
  }

  emitPropertyMetadata(property: PolymerProperty) {
    return {
      polymer: {
        notify: property.notify,
        observer: property.observer,
        readOnly: property.readOnly,
        attributeType: property.attributeType,
      }
    };
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
    behaviorReferences: Iterable<ScannedReference<'behavior'>>,
    document: Document) {
  const warnings: Warning[] = [];
  const behaviors: Behavior[] = [];
  for (const scannedReference of behaviorReferences) {
    const resolvedReference = scannedReference.resolve(document);
    if (resolvedReference.warnings.length > 0) {
      warnings.push(...resolvedReference.warnings);
    }
    if (resolvedReference.feature) {
      behaviors.push(resolvedReference.feature);
    }
  }
  return {warnings, behaviors};
}
