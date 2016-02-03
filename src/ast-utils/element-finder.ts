/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

'use strict';
import * as estraverse from 'estraverse';

import * as esutil from './esutil';
import * as analyzeProperties from './analyze-properties';
import * as astValue from './ast-value';
import {declarationPropertyHandlers, PropertyHandlers} from './declaration-property-handlers';
import {ElementDescriptor, PropertyDescriptor} from './descriptors';
import {Visitor} from './fluent-traverse';
import * as estree from 'estree';

export function elementFinder() {
  /**
   * The list of elements exported by each traversed script.
   */
  var elements: ElementDescriptor[] = [];

  /**
   * The element being built during a traversal;
   */
  var element: ElementDescriptor = null;
  var propertyHandlers: PropertyHandlers = null;

  var visitors: Visitor = {
    enterCallExpression: function enterCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == 'Identifier') {
        const ident = <estree.Identifier>callee;
        if (ident.name == 'Polymer') {
          element = {
            type: 'element',
            desc: esutil.getAttachedComment(parent),
            events: esutil.getEventComments(parent).map( function(event) {
              return {desc: event};
            })
          };
          propertyHandlers = declarationPropertyHandlers(element);
        }
      }
    },
    leaveCallExpression: function leaveCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == 'Identifier') {
        const ident = <estree.Identifier>callee;
        if (ident.name == 'Polymer') {
          if (element) {
            elements.push(element);
            element = null;
            propertyHandlers = null;
          }
        }
      }
    },
    enterObjectExpression: function enterObjectExpression(node, parent) {
      if (element && !element.properties) {
        element.properties = [];
        element.behaviors = [];
        element.observers = [];
        var getters: {[name: string]: PropertyDescriptor} = {};
        var setters: {[name: string]: PropertyDescriptor} = {};
        var definedProperties: {[name: string]: PropertyDescriptor} = {};
        for (var i = 0; i < node.properties.length; i++) {
          var prop = node.properties[i];
          var name = esutil.objectKeyToString(prop.key);
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
          var descriptor = esutil.toPropertyDescriptor(prop);
          if (descriptor.getter) {
            getters[descriptor.name] = descriptor;
          } else if (descriptor.setter) {
            setters[descriptor.name] = descriptor;
          } else {
            element.properties.push(esutil.toPropertyDescriptor(prop));
          }
        }
        Object.keys(getters).forEach(function(getter) {
          var get = getters[getter];
          definedProperties[get.name] = get;
        });
        Object.keys(setters).forEach(function(setter) {
          var set = setters[setter];
          if (!(set.name in definedProperties)) {
            definedProperties[set.name] = set;
          } else {
            definedProperties[set.name].setter = true;
          }
        });
        Object.keys(definedProperties).forEach(function(p){
          var prop = definedProperties[p];
          element.properties.push(prop);
        });
        return estraverse.VisitorOption.Skip;
      }
    }
  };
  return {visitors: visitors, elements: elements};
};
