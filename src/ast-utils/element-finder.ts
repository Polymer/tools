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

'use strict';
import * as estraverse from 'estraverse';

import * as esutil from './esutil';
import * as analyzeProperties from './analyze-properties';
import * as astValue from './ast-value';
import {declarationPropertyHandlers, PropertyHandlers} from './declaration-property-handlers';
import {ElementDescriptor, PropertyDescriptor} from '../ast/ast';
import {Visitor} from './fluent-traverse';
import * as estree from 'estree';
import * as docs from './docs';

export function elementFinder() {
  /**
   * The list of elements exported by each traversed script.
   */
  const elements: ElementDescriptor[] = [];

  /**
   * The element being built during a traversal;
   */
  let element: ElementDescriptor = null;
  let propertyHandlers: PropertyHandlers = null;

  const visitors: Visitor = {

    classDetected: false,

    enterClassDeclaration: function enterClassDeclaration(node, parent) {
      this.classDetected = true;
      element = {
        type: 'element',
        desc: esutil.getAttachedComment(node),
        events: esutil.getEventComments(node).map((event) => ({desc: event})),
        properties: [],
        behaviors: [],
        observers: []
      };
      propertyHandlers = declarationPropertyHandlers(element);
    },

    leaveClassDeclaration: function leaveClassDeclaration(node, parent) {
      element.properties.map(property => docs.annotate(property));
      if (element) {
        elements.push(element);
        element = null;
        propertyHandlers = null;
      }
      this.classDetected = false;
    },

    enterAssignmentExpression(node, parent) {
      if (!element) {
        return;
      }
      const left = <estree.MemberExpression>node.left;
      if (left && left.object && left.object.type !== 'ThisExpression') {
        return;
      }
      const prop = <estree.Identifier>left.property;
      if (prop && prop.name) {
        const name = prop.name;
        if (name in propertyHandlers) {
          propertyHandlers[name](node.right);
        }
      }
    },

    enterMethodDefinition(node, parent) {
      if (!element) {
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
      const propDesc =
          <PropertyDescriptor>docs.annotate(esutil.toPropertyDescriptor(prop));
      if (prop && prop.kind === 'get' &&
          (propDesc.name === 'behaviors' || propDesc.name === 'observers')) {
        const returnStatement = <estree.ReturnStatement>node.value.body.body[0];
        const argument = <estree.ArrayExpression>returnStatement.argument;
        if (propDesc.name === 'behaviors') {
          argument.elements.forEach((elementObject: estree.Identifier) => {
            element.behaviors.push(elementObject.name);
          });
        } else {
          argument.elements.forEach((elementObject: estree.Literal) => {
            element.observers.push(
                {javascriptNode: elementObject, expression: elementObject.raw});
          });
        }
      } else {
        element.properties.push(propDesc);
      }
    },

    enterCallExpression(node, parent) {
      // When dealing with a class, enterCallExpression is called after the
      // parsing actually starts
      if (this.classDetected) {
        return estraverse.VisitorOption.Skip;
      }

      const callee = node.callee;
      if (callee.type === 'Identifier') {
        if (callee.name === 'Polymer') {
          element = {
            type: 'element',
            desc: esutil.getAttachedComment(parent),
            events: esutil.getEventComments(parent).map(
                (event) => ({desc: event}))
          };
          propertyHandlers = declarationPropertyHandlers(element);
        }
      }
    },

    leaveCallExpression: function leaveCallExpression(node, parent) {
      const callee = node.callee;
      const args = node.arguments;
      if (callee.type === 'Identifier' && args.length === 1 &&
          args[0].type === 'ObjectExpression') {
        if (callee.name === 'Polymer') {
          if (element) {
            elements.push(element);
            element = null;
            propertyHandlers = null;
          }
        }
      }
    },

    enterObjectExpression: function enterObjectExpression(node, parent) {
      // When dealing with a class, there is no single object that we can parse
      // to retrieve all properties
      if (this.classDetected) {
        return estraverse.VisitorOption.Skip;
      }

      if (element && !element.properties) {
        element.properties = [];
        element.behaviors = [];
        element.observers = [];
        const getters: {[name: string]: PropertyDescriptor} = {};
        const setters: {[name: string]: PropertyDescriptor} = {};
        const definedProperties: {[name: string]: PropertyDescriptor} = {};
        for (let i = 0; i < node.properties.length; i++) {
          const prop = node.properties[i];
          const name = esutil.objectKeyToString(prop.key);
          if (!name) {
            throw {
              message: 'Cant determine name for property key.',
              location: node.loc.start
            };
          }

          if (name in propertyHandlers) {
            propertyHandlers[name](prop.value);
            continue;
          }
          const descriptor = esutil.toPropertyDescriptor(prop);
          if (descriptor.getter) {
            getters[descriptor.name] = descriptor;
          } else if (descriptor.setter) {
            setters[descriptor.name] = descriptor;
          } else {
            element.properties.push(esutil.toPropertyDescriptor(prop));
          }
        }
        Object.keys(getters).forEach(function(getter) {
          const get = getters[getter];
          definedProperties[get.name] = get;
        });
        Object.keys(setters).forEach(function(setter) {
          const set = setters[setter];
          if (!(set.name in definedProperties)) {
            definedProperties[set.name] = set;
          } else {
            definedProperties[set.name].setter = true;
          }
        });
        Object.keys(definedProperties).forEach(function(p) {
          const prop = definedProperties[p];
          element.properties.push(prop);
        });
        return estraverse.VisitorOption.Skip;
      }
    }
  };

  return {visitors: visitors, elements: elements};
};
