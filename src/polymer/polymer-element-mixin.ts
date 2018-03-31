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

import {Annotation as JsDocAnnotation} from '../javascript/jsdoc';
import {Class, Document, ElementMixin, Privacy, ScannedElementMixin, ScannedMethod, ScannedReference, SourceRange} from '../model/model';

import {addMethod, addProperty, getBehaviors, LocalId, Observer, PolymerExtension, PolymerProperty, ScannedPolymerExtension, ScannedPolymerProperty} from './polymer-element';

export interface Options {
  name: string;
  jsdoc: JsDocAnnotation;
  description: string;
  summary: string;
  privacy: Privacy;
  sourceRange: SourceRange;
  mixins: ScannedReference<'element-mixin'>[];
  astNode: babel.Node;
  statementAst: babel.Statement|undefined;
  classAstNode?: babel.Node;
}

export class ScannedPolymerElementMixin extends ScannedElementMixin implements
    ScannedPolymerExtension {
  readonly properties: Map<string, ScannedPolymerProperty> = new Map();
  readonly methods: Map<string, ScannedMethod> = new Map();
  readonly staticMethods: Map<string, ScannedMethod> = new Map();
  readonly observers: Observer[] = [];
  readonly listeners: {event: string, handler: string}[] = [];
  readonly behaviorAssignments: ScannedReference<'behavior'>[] = [];
  pseudo: boolean = false;
  readonly abstract: boolean = false;
  readonly sourceRange: SourceRange;
  classAstNode?: babel.Node;

  constructor({
    name,
    jsdoc,
    description,
    summary,
    privacy,
    sourceRange,
    mixins,
    astNode,
    statementAst,
    classAstNode
  }: Options) {
    super({name});
    this.jsdoc = jsdoc;
    this.description = description;
    this.summary = summary;
    this.privacy = privacy;
    this.sourceRange = sourceRange;
    this.mixins = mixins;
    this.astNode = astNode;
    this.statementAst = statementAst;
    this.classAstNode = classAstNode;
  }

  addProperty(prop: ScannedPolymerProperty) {
    addProperty(this, prop);
  }

  addMethod(method: ScannedMethod) {
    addMethod(this, method);
  }

  resolve(document: Document): PolymerElementMixin {
    return new PolymerElementMixin(this, document);
  }
}

declare module '../model/queryable' {
  interface FeatureKindMap {
    'polymer-element-mixin': PolymerElementMixin;
  }
}
export class PolymerElementMixin extends ElementMixin implements
    PolymerExtension {
  // This property is assigned in the super class.
  readonly properties!: Map<string, PolymerProperty>;

  readonly observers: Observer[];
  readonly listeners: {event: string, handler: string}[] = [];
  readonly behaviorAssignments: ScannedReference<'behavior'>[] = [];
  readonly localIds: LocalId[] = [];
  readonly pseudo: boolean;

  constructor(scannedMixin: ScannedPolymerElementMixin, document: Document) {
    super(scannedMixin, document);
    this.kinds.add('polymer-element-mixin');
    this.pseudo = scannedMixin.pseudo;
    this.behaviorAssignments = Array.from(scannedMixin.behaviorAssignments);
    this.observers = Array.from(scannedMixin.observers);
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
      document: Document, init: ScannedPolymerElementMixin): Class[] {
    const prototypeChain = super._getSuperclassAndMixins(document, init);

    const {warnings, behaviors} =
        getBehaviors(init.behaviorAssignments, document);
    this.warnings.push(...warnings);
    prototypeChain.push(...behaviors);
    return prototypeChain;
  }
}
