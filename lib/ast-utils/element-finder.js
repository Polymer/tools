/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */
// jshint node: true
'use strict';
var estraverse = require('estraverse');

var esutil    = require('./esutil');
var findAlias = require('./find-alias');
var analyzeProperties = require('./analyze-properties');
var astValue = require('./ast-value');

var elementFinder = function elementFinder() {
  /**
   * The list of elements exported by each traversed script.
   */
  var elements = [];

  /**
   * The element being built during a traversal;
   */
  var element;

  /**
   * a set of special case properties. these should only be called
   * when we know we're inside an element definition.
   * @type {Object}
   */
  var propertyHandlers = {
    is: function(node) {
      if (node.type == 'Literal') {
        element.is = node.value;
      }
    },
    properties: function(node) {

      var props = analyzeProperties(node);

      for (var i=0; i<props.length; i++) {
        element.properties.push(props[i]);
      }
    },
    behaviors: function(node) {
      if (node.type != 'ArrayExpression') {
        return;
      }

      for (var i=0; i<node.elements.length; i++) {
        var v = astValue.expressionToValue(node.elements[i]);
        if (v === undefined)
          v = astValue.CANT_CONVERT;
        element.behaviors.push(v);
      }
    },
    observers: function(node) {
      if (node.type != 'ArrayExpression') {
        return;
      }
      for (var i=0; i<node.elements.length; i++) {
        var v = astValue.expressionToValue(node.elements[i]);
        if (v === undefined)
          v = astValue.CANT_CONVERT;
        element.observers.push({
          javascriptNode: node.elements[i],
          expression: v
        });
      }
    }
  };

  var visitors = {
    enterCallExpression: function enterCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == 'Identifier') {

        if (callee.name == 'Polymer') {
          element = {
            type: 'element',
            desc: esutil.getAttachedComment(parent),
            events: esutil.getEventComments(parent).map( function(event) {
              return {desc: event};
            })
          };
        }
      }
    },
    leaveCallExpression: function leaveCallExpression(node, parent) {
      var callee = node.callee;
      if (callee.type == 'Identifier') {
        if (callee.name == 'Polymer') {
          if (element) {
            elements.push(element);
            element = undefined;
          }
        }
      }
    },
    enterObjectExpression: function enterObjectExpression(node, parent) {
      if (element && !element.properties) {
        element.properties = [];
        element.behaviors = [];
        element.observers = [];
        var getters = {};
        var setters = {};
        var definedProperties = {};
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
          element.properties.push(p);
        });
        return estraverse.VisitorOption.Skip;
      }
    }
  };
  return {visitors: visitors, elements: elements};
};

module.exports = elementFinder;
