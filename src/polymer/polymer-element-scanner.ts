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
import {VisitorOption} from '../javascript/estraverse-shim';
import {Visitor} from '../javascript/estree-visitor';
import {getAttachedComment, getEventComments, getOrInferPrivacy, objectKeyToString, toScannedMethod} from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptScanner} from '../javascript/javascript-scanner';
import * as jsdoc from '../javascript/jsdoc';
import {Severity, Warning, WarningCarryingException} from '../model/model';

import {getBehaviorAssignmentOrWarning} from './declaration-property-handlers';
import {declarationPropertyHandlers, PropertyHandlers} from './declaration-property-handlers';
import * as docs from './docs';
import {parseExpressionInJsStringLiteral} from './expression-scanner';
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

class ElementVisitor implements Visitor {
  features: ScannedPolymerElement[] = [];

  /**
   * The element being built during a traversal;
   */
  element: ScannedPolymerElement|null = null;
  propertyHandlers: PropertyHandlers|null = null;
  classDetected: boolean = false;
  warnings: Warning[] = [];

  document: JavaScriptDocument;
  constructor(document: JavaScriptDocument) {
    this.document = document;
  }

  enterClassDeclaration(node: babel.ClassDeclaration, _: babel.Node) {
    this.classDetected = true;
    const className = node.id.name;
    const docs = jsdoc.parseJsdoc(getAttachedComment(node) || '');
    this.element = new ScannedPolymerElement({
      astNode: node,
      description: docs.description,
      events: getEventComments(node),
      sourceRange: this.document.sourceRangeForNode(node),
      className,
      privacy: getOrInferPrivacy(className, docs),
      abstract: jsdoc.hasTag(docs, 'abstract'),
      attributes: new Map(),
      properties: [],
      behaviors: [],
      extends: undefined,
      jsdoc: docs,
      listeners: [],
      methods: new Map(),
      staticMethods: new Map(),
      mixins: [],
      observers: [],
      superClass: undefined,
      tagName: undefined
    });
    this.propertyHandlers =
        declarationPropertyHandlers(this.element, this.document);
  }

  leaveClassDeclaration(_: babel.ClassDeclaration, _parent: babel.Node) {
    for (const property of this.element!.properties.values()) {
      docs.annotate(property);
    }
    // TODO(justinfagnani): this looks wrong, class definitions can be nested
    // so a definition in a method in a Polymer() declaration would end the
    // declaration early. We should track which class induced the current
    // element and finish the element when leaving _that_ class.
    this.element = null;
    this.propertyHandlers = null;
    this.classDetected = false;
  }

  enterAssignmentExpression(node: babel.AssignmentExpression, _: babel.Node) {
    if (!this.element) {
      return;
    }
    const left = <babel.MemberExpression>node.left;
    if (left && left.object && !babel.isThisExpression(left.object)) {
      return;
    }
    const prop = <babel.Identifier>left.property;
    if (prop && prop.name && this.propertyHandlers) {
      const name = prop.name;
      if (name in this.propertyHandlers) {
        this.propertyHandlers[name](node.right);
      }
    }
  }

  enterClassMethod(node: babel.ClassMethod, _parent: babel.Node) {
    const element = this.element;
    if (!element) {
      return;
    }

    const prop = Object.assign({}, node, {
      method: true,
      shorthand: false,
      computed: false,
    });

    if (node.kind === 'get') {
      // TODO(usergenic): Not sure what node.value.body means or why it should
      // have a body and why that is a return statement.  Please review this.
      const returnStatement = <babel.ReturnStatement>node.body.body[0];
      const argument = <babel.ArrayExpression>returnStatement.argument;
      const propDesc = toScannedPolymerProperty(
          prop, this.document.sourceRangeForNode(node)!, this.document);
      docs.annotate(propDesc);

      // We only support observers and behaviors getters that return array
      // literals.
      if ((propDesc.name === 'behaviors' || propDesc.name === 'observers') &&
          !Array.isArray(argument.elements)) {
        return;
      }

      if (propDesc.name === 'behaviors') {
        argument.elements.forEach((argNode) => {
          const result = getBehaviorAssignmentOrWarning(argNode, this.document);
          if (result.kind === 'warning') {
            element.warnings.push(result.warning);
          } else {
            element.behaviorAssignments.push(result.assignment);
          }
        });
        return;
      }

      if (propDesc.name === 'observers') {
        argument.elements.forEach((elementObject) => {
          const parseResult = parseExpressionInJsStringLiteral(
              this.document, elementObject, 'callExpression');
          element.warnings = element.warnings.concat(parseResult.warnings);
          let expressionText = undefined;
          if (babel.isLiteral(elementObject)) {
            expressionText = this.document.contents.slice(
                elementObject.start, elementObject.end);
          }
          element.observers.push({
            javascriptNode: elementObject,
            expression: expressionText,
            parsedExpression: parseResult.databinding
          });
        });
        return;
      }

      element.addProperty(propDesc);
      return;
    }

    if (node.kind === 'method') {
      const methodDesc = toScannedMethod(
          prop, this.document.sourceRangeForNode(node)!, this.document);
      docs.annotate(methodDesc);
      element.addMethod(methodDesc);
    }
  }

  enterCallExpression(node: babel.CallExpression, parent: babel.Node) {
    // When dealing with a class, enterCallExpression is called after the
    // parsing actually starts
    if (this.classDetected) {
      return VisitorOption.Skip;
    }

    const callee = node.callee;
    if (babel.isIdentifier(callee)) {
      if (callee.name === 'Polymer') {
        const rawDescription = getAttachedComment(parent);
        let className: undefined|string = undefined;
        if (babel.isAssignmentExpression(parent)) {
          className = getIdentifierName(parent.left);
        } else if (babel.isVariableDeclarator(parent)) {
          className = getIdentifierName(parent.id);
        }
        const jsDoc = jsdoc.parseJsdoc(rawDescription || '');
        this.element = new ScannedPolymerElement({
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
        this.element.description = (this.element.description || '').trim();
        this.propertyHandlers =
            declarationPropertyHandlers(this.element, this.document);
      }
    }
  }

  leaveCallExpression(node: babel.CallExpression, _: babel.Node) {
    const callee = node.callee;
    const args = node.arguments;
    if (babel.isIdentifier(callee) && args.length === 1 &&
        babel.isObjectExpression(args[0])) {
      if (callee.name === 'Polymer') {
        if (this.element) {
          this.features.push(this.element);
          this.element = null;
          this.propertyHandlers = null;
        }
      }
    }
  }

  enterObjectExpression(node: babel.ObjectExpression, _: babel.Node) {
    // When dealing with a class, there is no single object that we can
    // parse to retrieve all properties.
    if (this.classDetected) {
      return VisitorOption.Skip;
    }

    const element = this.element;
    if (element) {
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

        if (!this.propertyHandlers) {
          continue;
        }

        if (name in this.propertyHandlers) {
          this.propertyHandlers[name](prop.value);
          continue;
        }

        try {
          const scannedPolymerProperty = toScannedPolymerProperty(
              prop, this.document.sourceRangeForNode(prop)!, this.document);
          if (babel.isObjectMethod(prop) && prop.kind === 'get') {
            getters[scannedPolymerProperty.name] = scannedPolymerProperty;
          } else if (babel.isObjectMethod(prop) && prop.kind === 'set') {
            setters[scannedPolymerProperty.name] = scannedPolymerProperty;
          } else if (
              babel.isObjectMethod(prop) || babel.isFunction(prop.value)) {
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
      return VisitorOption.Skip;
    }
  }
}
