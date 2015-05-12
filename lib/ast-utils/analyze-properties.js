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

var esutil    = require('./esutil');

var analyzeProperties = function(node) {

  var analyzedProps = [];

  if (node.type != 'ObjectExpression') {
    return undefined;
  }
  for (var i = 0; i < node.properties.length; i++) {
    var property = node.properties[i];
    var prop = esutil.toPropertyDescriptor(property);
    prop.published = true;

    if (property.value.type == 'ObjectExpression') {
      /**
       * Parse the expression inside a property object block.
       * property: {
       *   key: {
       *     type: String,
       *     notify: true
       *   }
       * }
       */
      for (var j = 0; j < property.value.properties.length; j++) {
        var propertyArg = property.value.properties[j];
        var propertyKey = esutil.objectKeyToString(propertyArg.key);

        switch(propertyKey) {
          case 'type': {
            prop.type = esutil.objectKeyToString(propertyArg.value);
            if (!prop.type) {
              throw {
                message: 'Invalid type in property object.',
                location: propertyArg.loc.start
              };
            }
          }
          break;
          case 'notify': {
            var val = propertyArg.value;
            if (val.type != 'Literal' && val.type != 'UnaryExpression') {
              throw {
                message: 'Notify expects a conditional.',
                location: propertyArg.loc.start
              };
            }
            prop.notify = val.value;
          }
          break;
          case 'value': {
            var val = propertyArg.value;
            if (val.type === 'Literal') {
              prop.default = val.value;
            }
            else {
              ;// TODO(atotic): need to make strings out of UnaryExpression, FunctionExpression
            }
          }
          break;
          default:
          break;
        };
      }
    }

    if (!prop.type) {
      throw {
        message: 'Unable to determine name for property key.',
        location: node.loc.start
      };
    }

    analyzedProps.push(prop);
  }
  return analyzedProps;
}


module.exports = analyzeProperties;

