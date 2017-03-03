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

import * as astValue from '../javascript/ast-value';
import {getIdentifierName, getNamespacedIdentifier} from '../javascript/ast-value';
import {Visitor} from '../javascript/estree-visitor';
import * as esutil from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptScanner} from '../javascript/javascript-scanner';
import * as jsdoc from '../javascript/jsdoc';
import {ScannedElement, ScannedFeature} from '../model/model';
import {ScannedReference} from '../model/reference';
import {Severity, Warning} from '../warning/warning';

import {getOrInferPrivacy} from './js-utils';
import {ScannedPolymerElement} from './polymer-element';
import {getIsValue, getMethods, getProperties} from './polymer2-config';

export interface ScannedAttribute extends ScannedFeature {
  name: string;
  type?: string;
}

export class Polymer2ElementScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>): Promise<ScannedElement[]> {
    const visitor = new ElementVisitor(document);
    await visit(visitor);
    return visitor.getRegisteredElements();
  }
}

class ElementVisitor implements Visitor {
  private _possibleElements = new Map<string, ScannedElement>();
  private _registeredButNotFound = new Map<string, string>();
  private _elements: Set<ScannedElement> = new Set();
  private _document: JavaScriptDocument;

  private _currentElement: ScannedPolymerElement|null = null;
  private _currentElementNode: estree.Node|null = null;

  constructor(document: JavaScriptDocument) {
    this._document = document;
  }

  enterClassExpression(node: estree.ClassExpression, parent: estree.Node) {
    if (parent.type !== 'AssignmentExpression' &&
        parent.type !== 'VariableDeclarator') {
      return;
    }
    const className = astValue.getIdentifierName(
        parent.type === 'AssignmentExpression' ? parent.left : parent.id);
    if (className == null) {
      return;
    }
    const element = this._handleClass(node);
    if (element) {
      const nodeComments = esutil.getAttachedComment(node) || '';
      const nodeJsDocs = jsdoc.parseJsdoc(nodeComments);
      const namespacedClassName =
          getNamespacedIdentifier(className, nodeJsDocs);
      element.className = namespacedClassName;

      const summaryTag = jsdoc.getTag(nodeJsDocs, 'summary');
      element.summary = (summaryTag && summaryTag.description) || '';

      // Set the element on both the namespaced & unnamespaced names so that we
      // can detect registration by either name.
      this._possibleElements.set(namespacedClassName, element);
      this._possibleElements.set(className, element);
    }
  }

  enterClassDeclaration(node: estree.ClassDeclaration) {
    const element = this._handleClass(node);
    if (element) {
      const className = node.id.name;
      const nodeComments = esutil.getAttachedComment(node) || '';
      const nodeJsDocs = jsdoc.parseJsdoc(nodeComments);
      const namespacedClassName =
          getNamespacedIdentifier(className, nodeJsDocs);
      element.className = namespacedClassName;

      const summaryTag = jsdoc.getTag(nodeJsDocs, 'summary');
      element.summary = (summaryTag && summaryTag.description) || '';

      // Set the element on both the namespaced & unnamespaced names so that we
      // can detect registration by either name.
      this._possibleElements.set(className, element);
      this._possibleElements.set(namespacedClassName, element);
    }
  }

  enterVariableDeclaration(
      node: estree.VariableDeclaration, _parent: estree.Node) {
    // This is for cases when a class is defined by only applying a mixin
    // to a superclass, like: const Elem = Mixin(HTMLElement);
    // In this case we don't have a ClassDeclaration or ClassExpresion
    // to traverse into.

    // TODO(justinfagnani): factor out more common code for creating
    // an element from jsdocs.

    const comment = esutil.getAttachedComment(node) || '';
    const docs = jsdoc.parseJsdoc(comment);
    const isElement = this._hasPolymerDocTag(docs);
    const sourceRange = this._document.sourceRangeForNode(node);
    if (isElement) {
      const warnings: Warning[] = [];
      const _extends = this._getExtends(node, docs, warnings);
      const mixins = this._getMixins(node, docs, warnings);

      // The name of the variable is available in a child VariableDeclarator
      // so we save the element and node representing the element to access
      // in enterVariableDeclarator
      this._currentElementNode = node;

      const className = astValue.getIdentifierName(node) || '';
      const namespacedClassName = getNamespacedIdentifier(className, docs);

      const element = this._currentElement = new ScannedPolymerElement({
        sourceRange,
        description: docs.description,
        superClass: _extends,  //
        mixins,
        className: namespacedClassName,
        privacy: getOrInferPrivacy(namespacedClassName, docs, false)
      });
      this._elements.add(this._currentElement);


      const summaryTag = jsdoc.getTag(docs, 'summary');
      element.summary = (summaryTag && summaryTag.description) || '';

      // Set the element on both the namespaced & unnamespaced names so that we
      // can detect registration by either name.
      this._possibleElements.set(namespacedClassName, element);
      if (className) {
        this._possibleElements.set(className, element);
      }
    }
  }

  leaveVariableDeclaration(
      node: estree.VariableDeclaration, _parent: estree.Node) {
    if (this._currentElementNode === node) {
      // Clean up state when we leave a declaration that defined an element.
      this._currentElement = null;
      this._currentElementNode = null;
    }
  }

  enterVariableDeclarator(
      node: estree.VariableDeclarator, parent: estree.Node) {
    if (this._currentElement != null && parent === this._currentElementNode) {
      const name = (node.id as estree.Identifier).name;
      const parentComments = esutil.getAttachedComment(parent) || '';
      const parentJsDocs = jsdoc.parseJsdoc(parentComments);
      this._currentElement.className =
          getNamespacedIdentifier(name, parentJsDocs);
    }
  }

  /**
   * Returns the name of the superclass, if any.
   */
  private _getExtends(
      node: estree.ClassDeclaration|estree.ClassExpression|
      estree.VariableDeclaration,
      docs: jsdoc.Annotation, warnings: Warning[]): ScannedReference|undefined {
    const extendsAnnotations =
        docs.tags!.filter((tag) => tag.tag === 'extends');

    // prefer @extends annotations over extends clauses
    if (extendsAnnotations.length > 0) {
      const extendsId = extendsAnnotations[0].name;
      // TODO(justinfagnani): we need source ranges for jsdoc annotations
      const sourceRange = this._document.sourceRangeForNode(node)!;
      if (extendsId == null) {
        warnings.push({
          code: 'class-extends-annotation-no-id',
          message: '@extends annotation with no identifier',
          severity: Severity.WARNING, sourceRange,
        });
      } else {
        return new ScannedReference(extendsId, sourceRange);
      }
    } else if (
        node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
      // If no @extends tag, look for a superclass.
      // TODO(justinfagnani): Infer mixin applications and superclass from AST.
      const superClass = node.superClass;
      if (superClass != null) {
        const extendsId = getIdentifierName(superClass);
        if (extendsId != null) {
          const sourceRange = this._document.sourceRangeForNode(superClass)!;
          return new ScannedReference(extendsId, sourceRange);
        }
      }
    }
  }

  private _getMixins(
      node: estree.Node, docs: jsdoc.Annotation, warnings: Warning[]) {
    const mixesAnnotations = docs.tags!.filter((tag) => tag.tag === 'mixes');
    return mixesAnnotations
        .map((annotation) => {
          const mixinId = annotation.name;
          // TODO(justinfagnani): we need source ranges for jsdoc
          // annotations
          const sourceRange = this._document.sourceRangeForNode(node)!;
          if (mixinId == null) {
            warnings.push({
              code: 'class-mixes-annotation-no-id',
              message:
                  '@mixes annotation with no identifier. Usage `@mixes MixinName`',
              severity: Severity.WARNING, sourceRange,
            });
            return;
          }
          return new ScannedReference(mixinId, sourceRange);
        })
        .filter((m) => m != null) as ScannedReference[];
  }

  private _handleClass(node: estree.ClassDeclaration|estree.ClassExpression) {
    const comment = esutil.getAttachedComment(node) || '';
    const docs = jsdoc.parseJsdoc(comment);
    const isValue = getIsValue(node);
    const warnings: Warning[] = [];

    const _extends = this._getExtends(node, docs, warnings);
    const mixins = this._getMixins(node, docs, warnings);

    const className = node.id && node.id.name;
    const element = new ScannedPolymerElement({
      tagName: isValue,
      description: (docs.description || '').trim(),
      events: esutil.getEventComments(node),
      sourceRange: this._document.sourceRangeForNode(node),
      properties: getProperties(node, this._document),
      methods: getMethods(node, this._document),
      superClass: _extends, mixins, className,
      privacy: getOrInferPrivacy(className || '', docs, false),
    });

    // If a class defines observedAttributes, it overrides what the base classes
    // defined.
    // TODO(justinfagnani): define and handle composition patterns.
    const observedAttributes = this._getObservedAttributes(node);

    if (observedAttributes != null) {
      element.attributes = observedAttributes;
    }

    warnings.forEach((w) => element.warnings.push(w));

    if (this._hasPolymerDocTag(docs)) {
      this._elements.add(element);
    }
    return element;
  }

  enterCallExpression(node: estree.CallExpression) {
    const callee = astValue.getIdentifierName(node.callee);
    if (!(callee === 'window.customElements.define' ||
          callee === 'customElements.define')) {
      return;
    }
    const tagName =
        node.arguments[0] && astValue.expressionToValue(node.arguments[0]);
    if (tagName == null || (typeof tagName !== 'string')) {
      return;
    }
    const elementDefn = node.arguments[1];
    if (elementDefn == null) {
      return;
    }
    const element: ScannedElement|null = this._getElement(tagName, elementDefn);
    if (!element) {
      return;
    }
    element.tagName = tagName;
    this._elements.add(element);
  }

  private _getElement(tagName: string, elementDefn: estree.Node): ScannedElement
      |null {
    const className = astValue.getIdentifierName(elementDefn);
    if (className) {
      const element = this._possibleElements.get(className);
      if (element) {
        this._possibleElements.delete(className);
        return element;
      } else {
        this._registeredButNotFound.set(className, tagName);
        return null;
      }
    }
    if (elementDefn.type === 'ClassExpression') {
      return this._handleClass(elementDefn);
    }
    return null;
  }

  private _hasPolymerDocTag(docs: jsdoc.Annotation) {
    const tags = docs.tags || [];
    const elementTags =
        tags.filter((t: jsdoc.Tag) => t.tag === 'polymerElement');
    return elementTags.length >= 1;
  }

  private _getObservedAttributes(node: estree.ClassDeclaration|
                                 estree.ClassExpression) {
    const observedAttributesDefn: estree.MethodDefinition|undefined =
        node.body.body.find((m) => {
          if (m.type !== 'MethodDefinition' || !m.static) {
            return false;
          }
          return astValue.getIdentifierName(m.key) === 'observedAttributes';
        });
    if (observedAttributesDefn) {
      const body = observedAttributesDefn.value.body.body[0];
      if (body && body.type === 'ReturnStatement' && body.argument &&
          body.argument.type === 'ArrayExpression') {
        return this._extractAttributesFromObservedAttributes(body.argument);
      }
    }
  }

  /**
   * Extract attributes from the array expression inside a static
   * observedAttributes method.
   *
   * e.g.
   *     static get observedAttributes() {
   *       return [
   *         /** @type {boolean} When given the element is totally inactive \*\/
   *         'disabled',
   *         /** @type {boolean} When given the element is expanded \*\/
   *         'open'
   *       ];
   *     }
   */
  private _extractAttributesFromObservedAttributes(arry:
                                                       estree.ArrayExpression) {
    const results: ScannedAttribute[] = [];
    for (const expr of arry.elements) {
      const value = astValue.expressionToValue(expr);
      if (value && typeof value === 'string') {
        let description = '';
        let type: string|null = null;
        const comment = esutil.getAttachedComment(expr);
        if (comment) {
          const annotation = jsdoc.parseJsdoc(comment);
          description = annotation.description || description;
          const tags = annotation.tags || [];
          for (const tag of tags) {
            if (tag.tag === 'type') {
              type = type || tag.type;
            }
            description = description || tag.description || '';
          }
        }
        const attribute: ScannedAttribute = {
          name: value,
          description: description,
          sourceRange: this._document.sourceRangeForNode(expr),
          astNode: expr,
          warnings: [],
        };
        if (type) {
          attribute.type = type;
        }
        results.push(attribute);
      }
    }
    return results;
  }


  /**
   * Gets all found elements. Can only be called once.
   */
  getRegisteredElements(): ScannedElement[] {
    for (const classAndTag of this._registeredButNotFound.entries()) {
      const className = classAndTag[0];
      const tagName = classAndTag[1];
      const element = this._possibleElements.get(className);
      if (element) {
        element.className = className;
        element.tagName = tagName;
        this._elements.add(element);
      }
    }
    return Array.from(this._elements);
  }
}
