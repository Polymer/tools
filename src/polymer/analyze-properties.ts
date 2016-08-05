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

import {PropertyDescriptor} from '../ast/ast';
import * as astValue from '../javascript/ast-value';
import * as esutil from '../javascript/esutil';

export function analyzeProperties(node: estree.Node) {
  const analyzedProps: PropertyDescriptor[] = [];

  if (node.type !== 'ObjectExpression') {
    return analyzedProps;
  }
  for (const property of node.properties) {
    const prop = esutil.toPropertyDescriptor(property);
    prop.published = true;

    if (property.value.type !== 'ObjectExpression') {
      continue;
    }
    /**
     * Parse the expression inside a property object block. e.g.
     * property: {
     *   key: {
     *     type: String,
     *     notify: true,
     *     value: -1,
     *     readOnly: true,
     *     reflectToAttribute: true
     *   }
     * }
     */
    for (const propertyArg of property.value.properties) {
      const propertyKey = esutil.objectKeyToString(propertyArg.key);

      switch (propertyKey) {
        case 'type':
          prop.type = esutil.objectKeyToString(propertyArg.value);
          prop.type = esutil.CLOSURE_CONSTRUCTOR_MAP[prop.type] || prop.type;
          if (prop.type === undefined) {
            throw {
              message: 'Invalid type in property object.',
              location: propertyArg.loc.start
            };
          }
          break;
        case 'notify':
          prop.notify = astValue.expressionToValue(propertyArg.value);
          if (prop.notify === undefined) {
            prop.notify = astValue.CANT_CONVERT;
          }
          break;
        case 'observer':
          prop.observer = astValue.expressionToValue(propertyArg.value);
          prop.observerNode = propertyArg.value;
          if (prop.observer === undefined) {
            prop.observer = astValue.CANT_CONVERT;
          }
          break;
        case 'readOnly':
          prop.readOnly = astValue.expressionToValue(propertyArg.value);
          if (prop.readOnly === undefined) {
            prop.readOnly = astValue.CANT_CONVERT;
          }
          break;
        case 'reflectToAttribute':
          prop.reflectToAttribute = astValue.expressionToValue(propertyArg);
          if (prop.reflectToAttribute === undefined) {
            prop.reflectToAttribute = astValue.CANT_CONVERT;
          }
          break;
        case 'value':
          prop.default = astValue.expressionToValue(propertyArg.value);
          if (prop.default === undefined) {
            prop.default = astValue.CANT_CONVERT;
          }
          break;
        default:
          break;
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
};
