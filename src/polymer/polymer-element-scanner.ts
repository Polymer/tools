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
import {getIdentifierName} from '../javascript/ast-value';
import {Visitor} from '../javascript/estree-visitor';
import {getAttachedComment, getEventComments, getOrInferPrivacy, objectKeyToString, toScannedMethod} from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptScanner} from '../javascript/javascript-scanner';
import * as jsdoc from '../javascript/jsdoc';
import {Severity, Warning, WarningCarryingException} from '../model/model';

import {declarationPropertyHandlers, PropertyHandlers} from './declaration-property-handlers';
import {toScannedPolymerProperty} from './js-utils';
import {ScannedPolymerElement, ScannedPolymerProperty} from './polymer-element';

export class PolymerElementScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>) {
    const visitor = new ElementVisitor(document);
    await visit(visitor);
    return {features: visitor.features, warnings: visitor.warnings};
  }
}

/**
 * Handles Polymer({}) calls.
 */
class ElementVisitor implements Visitor {
  readonly features: ScannedPolymerElement[] = [];
  readonly warnings: Warning[] = [];
  readonly document: JavaScriptDocument;
  constructor(document: JavaScriptDocument) {
    this.document = document;
  }

  enterCallExpression(node: babel.CallExpression, parent: babel.Node) {
    const callee = node.callee;
    if (!babel.isIdentifier(callee) || callee.name !== 'Polymer') {
      return;
    }
    const rawDescription = getAttachedComment(parent);
    let className: undefined|string = undefined;
    if (babel.isAssignmentExpression(parent)) {
      className = getIdentifierName(parent.left);
    } else if (babel.isVariableDeclarator(parent)) {
      className = getIdentifierName(parent.id);
    }
    const jsDoc = jsdoc.parseJsdoc(rawDescription || '');
    const element = new ScannedPolymerElement({
      className,
      astNode: node,
      description: jsDoc.description,
      events: getEventComments(parent),
      sourceRange: this.document.sourceRangeForNode(node.arguments[0]),
      privacy: getOrInferPrivacy('', jsDoc),
      abstract: jsdoc.hasTag(jsDoc, 'abstract'),
      attributes: new Map(),
      properties: [],
      behaviors: [],
      extends: undefined,
      jsdoc: jsDoc,
      listeners: [],
      methods: new Map(),
      staticMethods: new Map(),
      mixins: [],
      observers: [],
      superClass: undefined,
      tagName: undefined
    });
    element.description = (element.description || '').trim();
    const propertyHandlers =
        declarationPropertyHandlers(element, this.document);

    const argument = node.arguments[0];
    if (babel.isObjectExpression(argument)) {
      this.handleObjectExpression(argument, propertyHandlers, element);
    }

    this.features.push(element);
  }

  private handleObjectExpression(
      node: babel.ObjectExpression, propertyHandlers: PropertyHandlers,
      element: ScannedPolymerElement) {
    const getters: {[name: string]: ScannedPolymerProperty} = {};
    const setters: {[name: string]: ScannedPolymerProperty} = {};
    const definedProperties: {[name: string]: ScannedPolymerProperty} = {};
    for (const prop of node.properties) {
      if (babel.isSpreadProperty(prop)) {
        continue;
      }
      const name = objectKeyToString(prop.key);
      if (!name) {
        element.warnings.push(new Warning({
          message: `Can't determine name for property key from expression ` +
              `with type ${prop.key.type}.`,
          code: 'cant-determine-property-name',
          severity: Severity.WARNING,
          sourceRange: this.document.sourceRangeForNode(prop.key)!,
          parsedDocument: this.document
        }));
        continue;
      }

      if (!propertyHandlers) {
        continue;
      }

      if (name in propertyHandlers) {
        propertyHandlers[name](prop.value);
        continue;
      }

      try {
        const scannedPolymerProperty = toScannedPolymerProperty(
            prop, this.document.sourceRangeForNode(prop)!, this.document);
        if (babel.isObjectMethod(prop) && prop.kind === 'get') {
          getters[scannedPolymerProperty.name] = scannedPolymerProperty;
        } else if (babel.isObjectMethod(prop) && prop.kind === 'set') {
          setters[scannedPolymerProperty.name] = scannedPolymerProperty;
        } else if (babel.isObjectMethod(prop) || babel.isFunction(prop.value)) {
          const scannedPolymerMethod = toScannedMethod(
              prop, this.document.sourceRangeForNode(prop)!, this.document);
          element.addMethod(scannedPolymerMethod);
        } else {
          element.addProperty(scannedPolymerProperty);
        }
      } catch (e) {
        if (e instanceof WarningCarryingException) {
          element.warnings.push(e.warning);
          continue;
        }
        throw e;
      }
    }
    Object.keys(getters).forEach((name) => {
      const prop = getters[name];
      definedProperties[prop.name] = prop;
      prop.readOnly = !!setters[prop.name];
    });
    Object.keys(setters).forEach((name) => {
      const prop = setters[name];
      if (!(prop.name in definedProperties)) {
        definedProperties[prop.name] = prop;
      }
    });
    Object.keys(definedProperties).forEach((name) => {
      const prop = definedProperties[name];
      element.addProperty(prop);
    });
  }
}
