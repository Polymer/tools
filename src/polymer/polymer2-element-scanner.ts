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
import {getIdentifierName} from '../javascript/ast-value';
import {Visitor} from '../javascript/estree-visitor';
import * as esutil from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptScanner} from '../javascript/javascript-scanner';
import * as jsdoc from '../javascript/jsdoc';
import {ScannedElement, ScannedFeature} from '../model/model';
import {ScannedReference} from '../model/reference';
import {Severity, Warning} from '../warning/warning';

import {Options as PolymerElementOptions, ScannedPolymerElement} from './polymer-element';
import {getConfig, getIsValue, getProperties} from './polymer2-config';

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
  private _elements: ScannedElement[] = [];
  private _document: JavaScriptDocument;

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
      element.className = className;
      this._possibleElements.set(element.className, element);
    }
  }

  enterClassDeclaration(node: estree.ClassDeclaration) {
    const element = this._handleClass(node);
    if (element) {
      element.className = node.id.name;
      this._possibleElements.set(element.className, element);
    }
  }

  private _handleClass(node: estree.ClassDeclaration|estree.ClassExpression) {
    const comment = esutil.getAttachedComment(node) || '';
    const docs = jsdoc.parseJsdoc(comment);
    const config = getConfig(node);
    const isValue = getIsValue(node);
    const warnings: Warning[] = [];

    const extendsAnnotations =
        docs.tags!.filter((tag) => tag.tag === 'extends');
    let _extends: ScannedReference|undefined = undefined;

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
        _extends = new ScannedReference(extendsId, sourceRange);
      }
    } else if (node.superClass) {
      const extendsId = getIdentifierName(node.superClass);
      if (extendsId != null) {
        const sourceRange = this._document.sourceRangeForNode(node.superClass)!;
        _extends = new ScannedReference(extendsId, sourceRange);
      }
    }

    const elementOptions: PolymerElementOptions = {
      tagName: isValue,
      description: (docs.description || '').trim(),
      events: esutil.getEventComments(node),
      sourceRange: this._document.sourceRangeForNode(node),
      properties: (config && getProperties(config, this._document)) || [],
      superClass: _extends,
    };

    // TODO(justinfagnani): figure out how or if to reconcile attributes
    // elementOptions.attributes = this._getObservedAttributes(node) ||
    //     (element.properties as ScannedPolymerProperty[])
    //         .filter((p) => p.notify == true)
    //         .map((p) => p.name);

    const element = new ScannedPolymerElement(elementOptions);
    warnings.forEach((w) => element.warnings.push(w));

    if (this._hasPolymerDocTag(docs)) {
      this._elements.push(element);
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
    this._elements.push(element);
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

  // TODO(justinfagnani): move to vanilla element scanner
  // private _getObservedAttributes(node:
  // estree.ClassDeclaration|estree.ClassExpression) {
  //   const observedAttributesNode: estree.MethodDefinition =
  //       node.body.body.find((n) =>
  //         n.type === 'MethodDefinition' &&
  //         n.static === true &&
  //         astValue.getIdentifierName(n.key) === 'observedAttributes');
  //
  //   if (observedAttributesNode) {
  //     const body = observedAttributesNode.value.body.body[0];
  //     if (body && body.type === 'ReturnStatement' &&
  //         body.argument.type === 'ArrayExpression') {
  //       return this._extractAttributesFromObservedAttributes(body.argument);
  //     }
  //   }
  // }

  /**
   * Gets all found elements. Can only be called once.
   */
  getRegisteredElements(): ScannedElement[] {
    const results = this._elements;
    for (const classAndTag of this._registeredButNotFound.entries()) {
      const className = classAndTag[0];
      const tagName = classAndTag[1];
      const element = this._possibleElements.get(className);
      if (element) {
        element.className = className;
        element.tagName = tagName;
        results.push(element);
      }
    }
    return results;
  }
}
