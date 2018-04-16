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
import {ASTNode} from 'parse5';

import * as jsdoc from '../javascript/jsdoc';
import {ParsedDocument} from '../parser/document';

import {Class, ClassInit} from './class';
import {Privacy} from './feature';
import {ImmutableArray} from './immutable';
import {ScannedMethod} from './method';
import {AstNodeWithLanguage, Attribute, Document, Event, Feature, Resolvable, ScannedAttribute, ScannedEvent, ScannedProperty, ScannedReference, SourceRange, Warning} from './model';
import {FileRelativeUrl} from './url';
import {Severity} from './warning';

export {Visitor} from '../javascript/estree-visitor';

/**
 * Base class for ScannedElement and ScannedElementMixin.
 */
export abstract class ScannedElementBase implements Resolvable {
  properties = new Map<string, ScannedProperty>();
  attributes = new Map<string, ScannedAttribute>();
  description = '';
  summary = '';
  demos: Demo[] = [];
  events: Map<string, ScannedEvent> = new Map();
  sourceRange: SourceRange|undefined;
  staticMethods: Map<string, ScannedMethod> = new Map();
  methods: Map<string, ScannedMethod> = new Map();
  astNode: AstNodeWithLanguage|undefined = undefined;
  statementAst: babel.Statement|undefined;
  warnings: Warning[] = [];
  jsdoc?: jsdoc.Annotation;
  'slots': Slot[] = [];
  mixins: Array<ScannedReference<'element-mixin'>> = [];
  privacy!: Privacy;
  abstract: boolean = false;
  superClass?: ScannedReference<'class'> = undefined;

  applyHtmlComment(
      commentText: string|undefined,
      containingDocument: ParsedDocument|undefined) {
    if (commentText && containingDocument) {
      const commentJsdoc = jsdoc.parseJsdoc(commentText);
      // Add a Warning if there are already jsdoc tags or a description for this
      // element.
      if (this.sourceRange &&
          (this.description || this.jsdoc && this.jsdoc.tags.length > 0)) {
        this.warnings.push(new Warning({
          severity: Severity.WARNING,
          code: 'multiple-doc-comments',
          message:
              `${this.constructor.name} has both HTML doc and JSDoc comments.`,
          sourceRange: this.sourceRange,
          parsedDocument: containingDocument
        }));
      }
      this.jsdoc =
          this.jsdoc ? jsdoc.join(commentJsdoc, this.jsdoc) : commentJsdoc;
      this.description = [
        commentJsdoc.description || '',
        this.description || ''
      ].join('\n\n').trim();
    }
  }

  abstract resolve(_document: Document): Feature;
}

export class Slot {
  name: string;
  range: SourceRange;
  astNode?: AstNodeWithLanguage;

  constructor(
      name: string, range: SourceRange,
      astNode: AstNodeWithLanguage|undefined) {
    this.name = name;
    this.range = range;
    this.astNode = astNode;
  }
}

export interface Demo {
  desc?: string;
  path: FileRelativeUrl;
}

export interface ElementBaseInit extends ClassInit {
  readonly events?: Map<string, Event>;
  readonly attributes?: Map<string, Attribute>;
  readonly slots?: Slot[];
}

/**
 * The element's runtime contents.
 */
export type ElementTemplate = {
  /**
   * HTML that is stamped out without data binding or other
   * interpretation beyond normal HTML semantics.
   */
  kind: 'html',
  contents: ASTNode,
}|{
  /**
   * HTML that's interpreted with the polymer databinding
   * system.
   */
  kind: 'polymer-databinding',
  contents: ASTNode,
};

/**
 * Base class for Element and ElementMixin.
 */
export abstract class ElementBase extends Class implements Feature {
  attributes: Map<string, Attribute>;
  events: Map<string, Event>;
  'slots': ImmutableArray<Slot> = [];

  constructor(init: ElementBaseInit, document: Document) {
    super(init, document);
    const {
      events,
      attributes,
      slots = [],
    } = init;
    this.slots = Array.from(slots);

    // Initialization of these attributes is kinda awkward, as they're part
    // of the inheritance system. See `inheritFrom` below which *may* be
    // called by our superclass, but may not be.
    this.attributes = (this as any).attributes || new Map();
    this.events = (this as any).events || new Map();

    if (attributes !== undefined) {
      this._overwriteInherited(this.attributes, attributes, undefined, true);
    }
    if (events !== undefined) {
      this._overwriteInherited(this.events, events, undefined, true);
    }
  }

  protected inheritFrom(superClass: Class) {
    // This may run as part of the call to the super constructor, so we need
    // to validate initialization.
    this.attributes = this.attributes || new Map();
    this.events = this.events || new Map();

    super.inheritFrom(superClass);
    if (superClass instanceof ElementBase) {
      this._overwriteInherited(
          this.attributes, superClass.attributes, superClass.name);
      this._overwriteInherited(this.events, superClass.events, superClass.name);
    }

    // TODO(justinfagnani): slots, listeners, observers, dom-module?
    // What actually inherits?
  }

  emitAttributeMetadata(_attribute: Attribute): Object {
    return {};
  }

  emitEventMetadata(_event: Event): Object {
    return {};
  }

  template: undefined|ElementTemplate = undefined;
}
