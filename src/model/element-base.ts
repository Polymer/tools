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

import * as estree from 'estree';
import * as url from 'url';

import * as jsdoc from '../javascript/jsdoc';
import {getOrInferPrivacy} from '../polymer/js-utils';

import {Privacy} from './feature';
import {ImmutableArray, ImmutableSet} from './immutable';
import {Attribute, Document, Event, Feature, Method, Property, Reference, Resolvable, ScannedAttribute, ScannedEvent, ScannedProperty, ScannedReference, SourceRange, Warning} from './model';
import {Severity} from './warning';

export {Visitor} from '../javascript/estree-visitor';

/**
 * Base class for ScannedElement and ScannedElementMixin.
 */
export abstract class ScannedElementBase implements Resolvable {
  properties: ScannedProperty[] = [];
  attributes: ScannedAttribute[] = [];
  description = '';
  summary = '';
  demos: {desc?: string; path: string}[] = [];
  events: ScannedEvent[] = [];
  sourceRange: SourceRange|undefined;
  methods: Method[];
  astNode: estree.Node|null;
  warnings: Warning[] = [];
  jsdoc?: jsdoc.Annotation;
  'slots': Slot[] = [];
  mixins: ScannedReference[] = [];
  privacy: Privacy;

  superClass?: ScannedReference = undefined;

  applyHtmlComment(commentText: string|undefined) {
    this.description = this.description || commentText || '';
  }

  applyJsdocDemoTags(baseUrl: string): void {
    if (!this.jsdoc || !this.jsdoc.tags) {
      return;
    }
    this.demos = this.jsdoc.tags.filter((tag) => tag.tag === 'demo' && tag.name)
                     .map((tag) => ({
                            desc: tag.description || undefined,
                            path: url.resolve(baseUrl, tag.name!)
                          }));
  }

  resolve(_document: Document): any {
    throw new Error('abstract');
  }
}

export class Slot {
  name: string;
  range: SourceRange;

  constructor(name: string, range: SourceRange) {
    this.name = name;
    this.range = range;
  }
}

export interface Demo {
  desc?: string;
  path: string;
}

export interface ElementBaseInit {
  description: string;
  summary: string;
  demos?: Demo[];
  events?: Event[];
  sourceRange: SourceRange|undefined;
  properties?: Property[];
  attributes?: Attribute[];
  methods?: Method[];
  astNode: any;
  warnings?: Warning[];
  slots?: Slot[];
  privacy: Privacy;
  jsdoc?: jsdoc.Annotation;
  superClass?: ScannedReference;
  mixins?: ScannedReference[];
}

/**
 * Base class for Element and ElementMixin.
 */
export abstract class ElementBase implements Feature {
  readonly properties: Property[] = [];
  readonly attributes: Attribute[] = [];
  readonly methods: Method[] = [];
  description: string;
  readonly summary: string;
  readonly demos: Demo[] = [];
  readonly events: Event[] = [];
  readonly sourceRange: SourceRange|undefined;
  readonly jsdoc?: jsdoc.Annotation;
  readonly astNode: any;
  abstract kinds: ImmutableSet<string>;
  readonly warnings: Warning[] = [];
  'slots': Slot[] = [];
  readonly privacy: Privacy;
  readonly superClass?: Reference;

  abstract readonly name: string|undefined;

  /**
   * Mixins that this class declares with `@mixes`.
   *
   * Mixins are applied linearly after the superclass, in order from first
   * to last. Mixins that compose other mixins will be flattened into a
   * single list. A mixin can be applied more than once, each time its
   * members override those before it in the prototype chain.
   */
  readonly mixins: ImmutableArray<Reference>;

  constructor(init: ElementBaseInit, document: Document) {
    const {
      description,
      summary,
      demos = [],
      events = [],
      sourceRange,
      properties = [],
      attributes = [],
      methods = [],
      astNode,
      warnings = [],
      slots = [],
      privacy,
      jsdoc,
      superClass,
      mixins = [],
    } = init;
    this.description = description;
    this.summary = summary;
    this.demos = Array.from(demos);
    this.sourceRange = sourceRange;
    this.astNode = astNode;
    this.warnings = Array.from(warnings);
    this.slots = Array.from(slots);
    this.privacy = privacy;
    this.jsdoc = jsdoc;
    this.superClass = superClass ? superClass.resolve(document) : undefined;
    this.mixins = mixins.map((m) => m.resolve(document));

    const superClassLikes = this._getSuperclassAndMixins(document, init);
    for (const superClassLike of superClassLikes) {
      this.inheritFrom(superClassLike);
    }

    this._overwriteInherited(this.properties, properties, undefined, true);
    this._overwriteInherited(this.attributes, attributes, undefined, true);
    this._overwriteInherited(this.methods, methods, undefined, true);
    this._overwriteInherited(this.events, events, undefined, true);

    // TODO(rictic): this is an awkward place for this. Move it back to
    //     scanning time.
    for (const method of this.methods) {
      // methods are only public by default if they're documented.
      method.privacy = getOrInferPrivacy(method.name, method.jsdoc, true);
    }
  }

  /**
   * Returns the classes for our super class and any mixins or mixin-like
   * things.
   *
   * The order of the returned array is important. Members of earlier classes
   * will be overridden by members of later classes.
   */
  protected _getSuperclassAndMixins(
      document: Document, _init: ElementBaseInit) {
    const mixins = this.mixins.map(
        (m) =>
            this._resolveReferenceToSuperClass(m, document, 'element-mixin'));
    const superClass = this._resolveReferenceToSuperClass(
        this.superClass, document, 'element');

    const prototypeChain: ElementBase[] = [];
    if (superClass) {
      prototypeChain.push(superClass);
    }
    for (const mixin of mixins) {
      if (mixin) {
        prototypeChain.push(mixin);
      }
    }

    return prototypeChain;
  }

  // TODO(rictic): move to Reference?
  protected _resolveReferenceToSuperClass(
      reference: Reference|undefined, document: Document,
      kind: 'element'|'element-mixin'): ElementBase|undefined {
    if (!reference || reference.identifier === 'HTMLElement') {
      return undefined;
    }
    const superElements = document.getFeatures({
      kind: kind,
      id: reference.identifier,
      externalPackages: true,
      imported: true,
    });

    if (superElements.size < 1) {
      this.warnings.push({
        message: `Unable to resolve superclass ${reference.identifier}`,
        severity: Severity.ERROR,
        code: 'unknown-superclass',
        sourceRange: reference.sourceRange!,
      });
      return undefined;
    } else if (superElements.size > 1) {
      this.warnings.push({
        message: `Multiple superclasses found for ${reference.identifier}`,
        severity: Severity.ERROR,
        code: 'unknown-superclass',
        sourceRange: reference.sourceRange!,
      });
      return undefined;
    }
    return superElements.values().next().value;
  }

  protected inheritFrom(superClass: ElementBase) {
    this._overwriteInherited(
        this.properties, superClass.properties, superClass.name);
    this._overwriteInherited(this.methods, superClass.methods, superClass.name);
    this._overwriteInherited(
        this.attributes, superClass.attributes, superClass.name);
    this._overwriteInherited(this.events, superClass.events, superClass.name);

    // TODO(justinfagnani): slots, listeners, observers, dom-module?
    // What actually inherits?
  }

  /**
   * This method is applied to an array of members to overwrite members lower in
   * the prototype graph (closer to Object) with members higher up (closer to
   * the final class we're constructing).
   *
   * @param . existing The array of members so far. N.B. *This param is
   * mutated.*
   * @param . overriding The array of members from this new, higher prototype in
   *   the graph
   * @param . overridingClassName The name of the prototype whose members are
   *   being applied over the existing ones. Should be `undefined` when
   *   applyingSelf is true
   * @param . applyingSelf True on the last call to this method, when we're
   *   applying the class's own local members.
   */
  protected _overwriteInherited<P extends PropertyLike>(
      existing: P[], overriding: P[], overridingClassName: string|undefined,
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
          let warningSourceRange = this.sourceRange!;
          if (applyingSelf) {
            warningSourceRange = newVal.sourceRange || this.sourceRange!;
          }
          this.warnings.push({
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

  get identifiers(): Set<string> {
    throw new Error('abstract');
  }

  emitMetadata(): Object {
    return {};
  }

  emitPropertyMetadata(_property: Property): Object {
    return {};
  }

  emitAttributeMetadata(_attribute: Attribute): Object {
    return {};
  }

  emitMethodMetadata(_property: Method): Object {
    return {};
  }

  emitEventMetadata(_event: Event): Object {
    return {};
  }
}

export interface PropertyLike {
  name: string;
  sourceRange?: SourceRange;
  inheritedFrom?: string;
  privacy?: Privacy;
}
