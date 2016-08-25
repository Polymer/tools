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

import * as estraverse from 'estraverse';
import * as estree from 'estree';

import * as astValue from '../javascript/ast-value';
import {Visitor} from '../javascript/estree-visitor';
import * as esutil from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptEntityFinder} from '../javascript/javascript-entity-finder';

import {PropertyHandlers, declarationPropertyHandlers} from './declaration-property-handlers';
import * as docs from './docs';
import {ScannedPolymerElement, ScannedPolymerProperty} from './element-descriptor';

export class PolymerElementFinder implements JavaScriptEntityFinder {
  async findEntities(
      document: JavaScriptDocument, visit: (visitor: Visitor) => Promise<void>):
      Promise<ScannedPolymerElement[]> {
    const visitor = new ElementVisitor(document);
    await visit(visitor);
    return visitor.entities;
  }
}

class ElementVisitor implements Visitor {
  entities: ScannedPolymerElement[] = [];

  /**
   * The element being built during a traversal;
   */
  element: ScannedPolymerElement = null;
  propertyHandlers: PropertyHandlers = null;
  classDetected: boolean = false;

  document: JavaScriptDocument;
  constructor(document: JavaScriptDocument) {
    this.document = document;
  }

  enterClassDeclaration(node: estree.ClassDeclaration, _: estree.Node) {
    this.classDetected = true;
    this.element = new ScannedPolymerElement({
      description: esutil.getAttachedComment(node),
      events: esutil.getEventComments(node),
      sourceRange: this.document.sourceRangeForNode(node)
    });
    this.propertyHandlers =
        declarationPropertyHandlers(this.element, this.document);
  }

  leaveClassDeclaration(_: estree.ClassDeclaration, _parent: estree.Node) {
    this.element.properties.map((property) => docs.annotate(property));
    // TODO(justinfagnani): this looks wrong, class definitions can be nested
    // so a definition in a method in a Polymer() declaration would end the
    // declaration early. We should track which class induced the current
    // element and finish the element when leaving _that_ class.
    this.element = null;
    this.propertyHandlers = null;
    this.classDetected = false;
  }

  enterAssignmentExpression(node: estree.AssignmentExpression, _: estree.Node) {
    if (!this.element) {
      return;
    }
    const left = <estree.MemberExpression>node.left;
    if (left && left.object && left.object.type !== 'ThisExpression') {
      return;
    }
    const prop = <estree.Identifier>left.property;
    if (prop && prop.name) {
      const name = prop.name;
      if (name in this.propertyHandlers) {
        this.propertyHandlers[name](node.right);
      }
    }
  }

  enterMethodDefinition(node: estree.MethodDefinition, _: estree.Node) {
    if (!this.element) {
      return;
    }
    const prop = <estree.Property>{
      key: node.key,
      value: node.value,
      kind: node.kind,
      method: true,
      leadingComments: node.leadingComments,
      shorthand: false,
      computed: false,
      type: 'Property'
    };
    const propDesc = docs.annotate(esutil.toScannedPolymerProperty(
        prop, this.document.sourceRangeForNode(prop)));
    if (prop && prop.kind === 'get' &&
        (propDesc.name === 'behaviors' || propDesc.name === 'observers')) {
      const returnStatement = <estree.ReturnStatement>node.value.body.body[0];
      const argument = <estree.ArrayExpression>returnStatement.argument;
      if (propDesc.name === 'behaviors') {
        argument.elements.forEach((elementNode) => {
          this.element.behaviors.push(astValue.getIdentifierName(elementNode));
        });
      } else {
        argument.elements.forEach((elementObject: estree.Literal) => {
          this.element.observers.push(
              {javascriptNode: elementObject, expression: elementObject.raw});
        });
      }
    } else {
      this.element.addProperty(propDesc);
    }
  }

  enterCallExpression(node: estree.CallExpression, parent: estree.Node) {
    // When dealing with a class, enterCallExpression is called after the
    // parsing actually starts
    if (this.classDetected) {
      return estraverse.VisitorOption.Skip;
    }

    const callee = node.callee;
    if (callee.type === 'Identifier') {
      if (callee.name === 'Polymer') {
        this.element = new ScannedPolymerElement({
          description: esutil.getAttachedComment(parent),
          events: esutil.getEventComments(parent),
          sourceRange: this.document.sourceRangeForNode(node.arguments[0])
        });
        docs.annotate(this.element);
        this.element.description = (this.element.description || '').trim();
        this.propertyHandlers =
            declarationPropertyHandlers(this.element, this.document);
      }
    }
  }

  leaveCallExpression(node: estree.CallExpression, _: estree.Node) {
    const callee = node.callee;
    const args = node.arguments;
    if (callee.type === 'Identifier' && args.length === 1 &&
        args[0].type === 'ObjectExpression') {
      if (callee.name === 'Polymer') {
        if (this.element) {
          this.entities.push(this.element);
          this.element = null;
          this.propertyHandlers = null;
        }
      }
    }
  }

  enterObjectExpression(node: estree.ObjectExpression, _: estree.Node) {
    // When dealing with a class, there is no single object that we can parse to
    // retrieve all properties
    if (this.classDetected) {
      return estraverse.VisitorOption.Skip;
    }

    // TODO(justinfagnani): is the second clause needed?
    if (this.element) {
      const getters: {[name: string]: ScannedPolymerProperty} = {};
      const setters: {[name: string]: ScannedPolymerProperty} = {};
      const definedProperties: {[name: string]: ScannedPolymerProperty} = {};
      for (const prop of node.properties) {
        const name = esutil.objectKeyToString(prop.key);
        if (!name) {
          throw {
            message: 'Cant determine name for property key.',
            location: node.loc.start
          };
        }

        if (name in this.propertyHandlers) {
          this.propertyHandlers[name](prop.value);
          continue;
        }
        const scannedPolymerProperty = esutil.toScannedPolymerProperty(
            prop, this.document.sourceRangeForNode(prop));
        if (scannedPolymerProperty.getter) {
          getters[scannedPolymerProperty.name] = scannedPolymerProperty;
        } else if (scannedPolymerProperty.setter) {
          setters[scannedPolymerProperty.name] = scannedPolymerProperty;
        } else {
          this.element.addProperty(esutil.toScannedPolymerProperty(
              prop, this.document.sourceRangeForNode(prop)));
        }
      }
      Object.keys(getters).forEach((getter) => {
        const get = getters[getter];
        definedProperties[get.name] = get;
      });
      Object.keys(setters).forEach((setter) => {
        const set = setters[setter];
        if (!(set.name in definedProperties)) {
          definedProperties[set.name] = set;
        } else {
          definedProperties[set.name].setter = true;
        }
      });
      Object.keys(definedProperties).forEach((p) => {
        const prop = definedProperties[p];
        this.element.addProperty(prop);
      });
      return estraverse.VisitorOption.Skip;
    }
  }
}
