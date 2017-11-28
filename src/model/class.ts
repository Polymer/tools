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

import * as jsdocLib from '../javascript/jsdoc';
import {Document, Feature, Method, Privacy, Property, Reference, Resolvable, ScannedFeature, ScannedMethod, ScannedProperty, ScannedReference, Severity, SourceRange, Warning} from '../model/model';
import {ParsedDocument} from '../parser/document';

import {Demo} from './element-base';
import {ImmutableMap} from './immutable';

/**
 * Represents a JS class as encountered in source code.
 *
 * We only emit a ScannedClass when there's not a more specific kind of feature.
 * Like, we don't emit a ScannedClass when we encounter an element or a mixin
 * (though in the future those features will likely extend from
 * ScannedClass/Class).
 *
 * TODO(rictic): currently there's a ton of duplicated code across the Class,
 *     Element, Mixin, PolymerElement, and PolymerMixin classes. We should
 *     really unify this stuff to a single representation and set of algorithms.
 */
export class ScannedClass implements ScannedFeature, Resolvable {
  readonly name: string|undefined;
  /** The name of the class in the local scope where it is defined. */
  readonly localName: string|undefined;
  readonly astNode: babel.Node;
  readonly jsdoc: jsdocLib.Annotation;
  readonly description: string;
  readonly summary: string;
  readonly sourceRange: SourceRange;
  readonly properties: Map<string, ScannedProperty>;
  readonly staticMethods: ImmutableMap<string, ScannedMethod>;
  readonly methods: ImmutableMap<string, ScannedMethod>;
  readonly superClass: ScannedReference|undefined;
  readonly mixins: ScannedReference[];
  readonly abstract: boolean;
  readonly privacy: Privacy;
  readonly warnings: Warning[];
  readonly demos: {desc?: string; path: string}[];
  constructor(
      className: string|undefined, localClassName: string|undefined,
      astNode: babel.Node, jsdoc: jsdocLib.Annotation, description: string,
      sourceRange: SourceRange, properties: Map<string, ScannedProperty>,
      methods: Map<string, ScannedMethod>,
      staticMethods: Map<string, ScannedMethod>,
      superClass: ScannedReference|undefined, mixins: ScannedReference[],
      privacy: Privacy, warnings: Warning[], abstract: boolean, demos: Demo[]) {
    this.name = className;
    this.localName = localClassName;
    this.astNode = astNode;
    this.jsdoc = jsdoc;
    this.description = description;
    this.sourceRange = sourceRange;
    this.properties = properties;
    this.methods = methods;
    this.staticMethods = staticMethods;
    this.superClass = superClass;
    this.mixins = mixins;
    this.privacy = privacy;
    this.warnings = warnings;
    this.abstract = abstract;
    const summaryTag = jsdocLib.getTag(jsdoc, 'summary');
    this.summary = (summaryTag && summaryTag.description) || '';
    this.demos = demos;
  }

  resolve(document: Document): Feature|undefined {
    return new Class(this, document);
  }
}

declare module '../model/queryable' {
  interface FeatureKindMap {
    'class': Class;
  }
}

export interface ClassInit {
  readonly sourceRange: SourceRange|undefined;
  readonly astNode: any;
  readonly warnings?: Warning[];
  readonly summary: string;
  // TODO(rictic): we don't need both name and className here.
  readonly name?: string;
  readonly className?: string;
  readonly jsdoc?: jsdocLib.Annotation;
  readonly description: string;
  readonly properties?: ImmutableMap<string, Property>;
  readonly staticMethods: ImmutableMap<string, Method>;
  readonly methods?: ImmutableMap<string, Method>;
  readonly superClass?: ScannedReference|undefined;
  readonly mixins?: ScannedReference[];
  readonly abstract: boolean;
  readonly privacy: Privacy;
  readonly demos?: Demo[];
}
export class Class implements Feature {
  readonly kinds = new Set(['class']);
  readonly identifiers = new Set<string>();
  readonly sourceRange: SourceRange|undefined;
  readonly astNode: any;
  readonly warnings: Warning[];
  readonly summary: string;
  readonly name: string|undefined;

  /**
   * @deprecated use the `name` field instead.
   */
  get className() {
    return this.name;
  }
  readonly jsdoc: jsdocLib.Annotation|undefined;
  description: string;
  readonly properties = new Map<string, Property>();
  readonly methods = new Map<string, Method>();
  readonly staticMethods = new Map<string, Method>();
  readonly superClass: Reference|undefined;
  /**
   * Mixins that this class declares with `@mixes`.
   *
   * Mixins are applied linearly after the superclass, in order from first
   * to last. Mixins that compose other mixins will be flattened into a
   * single list. A mixin can be applied more than once, each time its
   * members override those before it in the prototype chain.
   */
  readonly mixins: Reference[] = [];
  readonly abstract: boolean;
  readonly privacy: Privacy;
  demos: Demo[];
  private readonly _parsedDocument: ParsedDocument;

  constructor(init: ClassInit, document: Document) {
    ({
      jsdoc: this.jsdoc,
      description: this.description,
      summary: this.summary,
      abstract: this.abstract,
      privacy: this.privacy,
      astNode: this.astNode,
      sourceRange: this.sourceRange
    } = init);

    this._parsedDocument = document.parsedDocument;

    this.warnings =
        init.warnings === undefined ? [] : Array.from(init.warnings);
    this.demos = [...init.demos || [], ...jsdocLib.extractDemos(init.jsdoc)];

    this.name = init.name || init.className;
    if (this.name) {
      this.identifiers.add(this.name);
    }

    if (init.superClass) {
      this.superClass = init.superClass.resolve(document);
    }
    this.mixins = (init.mixins || []).map((m) => m.resolve(document));

    const superClassLikes = this._getSuperclassAndMixins(document, init);
    for (const superClassLike of superClassLikes) {
      this.inheritFrom(superClassLike);
    }

    if (init.properties !== undefined) {
      this._overwriteInherited(
          this.properties, init.properties, undefined, true);
    }
    if (init.methods !== undefined) {
      this._overwriteInherited(this.methods, init.methods, undefined, true);
    }
    if (init.staticMethods !== undefined) {
      this._overwriteInherited(
          this.staticMethods, init.staticMethods, undefined, true);
    }
  }

  protected inheritFrom(superClass: Class) {
    this._overwriteInherited(
        this.staticMethods, superClass.staticMethods, superClass.name);
    this._overwriteInherited(
        this.properties, superClass.properties, superClass.name);
    this._overwriteInherited(this.methods, superClass.methods, superClass.name);
  }

  /**
   * This method is applied to an array of members to overwrite members lower in
   * the prototype graph (closer to Object) with members higher up (closer to
   * the final class we're constructing).
   *
   * @param . existing The array of members so far. N.B. *This param is
   *   mutated.*
   * @param . overriding The array of members from this new, higher prototype in
   *   the graph
   * @param . overridingClassName The name of the prototype whose members are
   *   being applied over the existing ones. Should be `undefined` when
   *   applyingSelf is true
   * @param . applyingSelf True on the last call to this method, when we're
   *   applying the class's own local members.
   */
  protected _overwriteInherited<P extends PropertyLike>(
      existing: Map<string, P>, overriding: ImmutableMap<string, P>,
      overridingClassName: string|undefined, applyingSelf = false) {
    for (const [key, overridingVal] of overriding) {
      const newVal = Object.assign({}, overridingVal, {
        inheritedFrom: overridingVal['inheritedFrom'] || overridingClassName
      });
      if (existing.has(key)) {
        /**
         * TODO(rictic): if existingVal.privacy is protected, newVal should be
         *    protected unless an explicit privacy was specified.
         *    https://github.com/Polymer/polymer-analyzer/issues/631
         */
        const existingValue = existing.get(key)!;
        if (existingValue.privacy === 'private') {
          let warningSourceRange = this.sourceRange!;
          if (applyingSelf) {
            warningSourceRange = newVal.sourceRange || this.sourceRange!;
          }
          this.warnings.push(new Warning({
            code: 'overriding-private',
            message: `Overriding private member '${overridingVal.name}' ` +
                `inherited from ${existingValue.inheritedFrom || 'parent'}`,
            sourceRange: warningSourceRange,
            severity: Severity.WARNING,
            parsedDocument: this._parsedDocument,
          }));
        }
      }
      existing.set(key, newVal);
    }
  }

  /**
   * Returns the elementLikes that make up this class's prototype chain.
   *
   * Should return them in the order that they're constructed in JS
   * engine (i.e. closest to HTMLElement first, closest to `this` last).
   */
  protected _getSuperclassAndMixins(document: Document, _init: ClassInit) {
    const mixins = this.mixins.map(
        (m) => this._resolveReferenceToSuperClass(m, document, 'class'));
    const superClass =
        this._resolveReferenceToSuperClass(this.superClass, document, 'class');

    const prototypeChain: Class[] = [];
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

  protected _resolveReferenceToSuperClass(
      reference: Reference|undefined, document: Document, kind: 'class'): Class
      |undefined {
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
      this.warnings.push(new Warning({
        message: `Unable to resolve superclass ${reference.identifier}`,
        severity: Severity.WARNING,
        code: 'unknown-superclass',
        sourceRange: reference.sourceRange!,
        parsedDocument: this._parsedDocument,
      }));
      return undefined;
    } else if (superElements.size > 1) {
      this.warnings.push(new Warning({
        message: `Multiple superclasses found for ${reference.identifier}`,
        severity: Severity.WARNING,
        code: 'unknown-superclass',
        sourceRange: reference.sourceRange!,
        parsedDocument: this._parsedDocument,
      }));
      return undefined;
    }
    return superElements.values().next().value;
  }

  emitMetadata(): object {
    return {};
  }

  emitPropertyMetadata(_property: Property): object {
    return {};
  }

  emitMethodMetadata(_method: Method): object {
    return {};
  }
}


export interface PropertyLike {
  name: string;
  sourceRange?: SourceRange;
  inheritedFrom?: string;
  privacy?: Privacy;
}
