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

import * as astValue from '../javascript/ast-value';
import * as esutil from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {ScannedProperty} from '../model/model';
import {Severity} from '../warning/warning';

import {toScannedPolymerProperty} from './js-utils';

export function analyzeProperties(
    node: estree.Node, document: JavaScriptDocument) {
  const analyzedProps: ScannedProperty[] = [];

  if (node.type !== 'ObjectExpression') {
    return analyzedProps;
  }
  for (const property of node.properties) {
    const prop = toScannedPolymerProperty(
        property, document.sourceRangeForNode(property)!);
    prop.published = true;

    let isComputed = false;

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
          prop.type = esutil.CLOSURE_CONSTRUCTOR_MAP[prop.type!] || prop.type;
          if (prop.type === undefined) {
            prop.warnings.push({
              code: 'invalid-property-type',
              message: 'Invalid type in property object.',
              severity: Severity.ERROR,
              sourceRange: document.sourceRangeForNode(propertyArg)!
            });
          }
          break;
        case 'notify':
          prop.notify = !!astValue.expressionToValue(propertyArg.value);
          break;
        case 'observer':
          const val = astValue.expressionToValue(propertyArg.value);
          prop.observerNode = propertyArg.value;
          if (val === undefined) {
            prop.observer = astValue.CANT_CONVERT;
          } else {
            prop.observer = JSON.stringify(val);
          }
          break;
        case 'readOnly':
          prop.readOnly = !!astValue.expressionToValue(propertyArg.value);
          break;
        case 'reflectToAttribute':
          prop.reflectToAttribute = !!astValue.expressionToValue(propertyArg);
          break;
        case 'computed':
          isComputed = true;
          break;
        case 'value':
          prop.default =
              JSON.stringify(astValue.expressionToValue(propertyArg.value));
          break;
        default:
          break;
      }
    }

    if (isComputed) {
      prop.readOnly = true;
    }

    if (!prop.type) {
      prop.warnings.push({
        code: 'no-type-for-property',
        message: 'Unable to determine type for property.',
        severity: Severity.WARNING,
        sourceRange: document.sourceRangeForNode(property)!
      });
    }

    analyzedProps.push(prop);
  }
  return analyzedProps;
};
