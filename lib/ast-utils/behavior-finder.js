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

var docs   = require('./docs');
var esutil = require('./esutil');
var jsdoc  = require('./jsdoc');
var analyzeProperties = require('./analyze-properties');

var numFeatures = 0;

module.exports = function behaviorFinder(attachAST) {
  /** @type {!Array<BehaviorDescriptor>} The behaviors we've found. */
  var behaviors = [];

  var currentBehavior = null;

  /**
   * special-case properties
   */
  var propertyHandlers = {
    properties: function(node) {
      var props = analyzeProperties(node);

      for (var i=0; i<props.length; i++) {
        currentBehavior.properties.push(props[i]);
      }
    }
  };

  var visitors = {

    /**
     * Look for object declarations with @behavior in the docs.
     */
    enterVariableDeclaration: function(node, parent) {
      if (node.declarations.length !== 1) return;  // Ambiguous.
      this._initBehavior(node, function () {
        return esutil.objectKeyToString(node.declarations[0].id);
      });
    },

    /**
     * Look for object assignments with @behavior in the docs.
     */
    enterAssignmentExpression: function(node, parent) {
      this._initBehavior(parent, function () {
        return esutil.objectKeyToString(node.left);
      });
    },

    _initBehavior: function(node, getName) {
      var comment = esutil.getAttachedComment(node);
      // Quickly filter down to potential candidates.
      if (!comment || comment.indexOf('@behavior') === -1) return;
      currentBehavior = {
        type: 'behavior',
        desc: comment,
      };

      docs.annotate(currentBehavior);
      // Make sure that we actually parsed a behavior tag!
      if (!jsdoc.hasTag(currentBehavior.jsdoc, 'behavior')) {
        currentBehavior = null;
        return;
      }

      var name = jsdoc.getTag(currentBehavior.jsdoc, 'behavior', 'name');
      if (!name) {
        name = getName();
      }
      if (!name) {
        console.warn('Unable to determine name for @behavior:', comment);
      }
      currentBehavior.is = name;
    },

    /**
     * We assume that the object expression after such an assignment is the
     * behavior's declaration. Seems to be a decent assumption for now.
     */
    enterObjectExpression: function(node, parent) {
      if (!currentBehavior || currentBehavior.properties) return;

      currentBehavior.properties = [];
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
        }
        else {
          currentBehavior.properties.push(esutil.toPropertyDescriptor(prop));
        }
      }
      behaviors.push(currentBehavior);
      currentBehavior = null;
    },

  };

  return {visitors: visitors, behaviors: behaviors};
};
