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

import {NodePath} from '@babel/traverse';
import * as babel from '@babel/types';

import {getIdentifierName} from '../javascript/ast-value';
import {Visitor} from '../javascript/estree-visitor';
import * as esutil from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptScanner} from '../javascript/javascript-scanner';
import * as jsdoc from '../javascript/jsdoc';
import {Severity, Warning} from '../model/model';

import {declarationPropertyHandlers, PropertyHandlers} from './declaration-property-handlers';
import {ScannedPolymerElement} from './polymer-element';

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

  enterCallExpression(
      node: babel.CallExpression, parent: babel.Node, path: NodePath) {
    const callee = node.callee;
    if (!babel.isIdentifier(callee) || callee.name !== 'Polymer') {
      return;
    }
    const rawDescription = esutil.getAttachedComment(parent);
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
      statementAst: esutil.getCanonicalStatement(path),
      description: jsDoc.description,
      events: esutil.getEventComments(parent),
      sourceRange: this.document.sourceRangeForNode(node.arguments[0]),
      privacy: esutil.getOrInferPrivacy('', jsDoc),
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
        declarationPropertyHandlers(element, this.document, path);

    const argument = node.arguments[0];
    if (babel.isObjectExpression(argument)) {
      this.handleObjectExpression(argument, propertyHandlers, element);
    }

    this.features.push(element);
  }

  private handleObjectExpression(
      node: babel.ObjectExpression, propertyHandlers: PropertyHandlers,
      element: ScannedPolymerElement) {
    for (const prop of esutil.getSimpleObjectProperties(node)) {
      const name = esutil.getPropertyName(prop);
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
      if (name in propertyHandlers) {
        propertyHandlers[name](prop.value);
      } else if (
          (babel.isMethod(prop) && prop.kind === 'method') ||
          babel.isFunction(prop.value)) {
        const method = esutil.toScannedMethod(
            prop, this.document.sourceRangeForNode(prop)!, this.document);
        element.addMethod(method);
      }
    }

    for (const prop of esutil
             .extractPropertiesFromClassOrObjectBody(node, this.document)
             .values()) {
      if (prop.name in propertyHandlers) {
        continue;
      }
      element.addProperty({
        ...prop,
        isConfiguration: esutil.configurationProperties.has(prop.name),
      });
    }
  }
}
