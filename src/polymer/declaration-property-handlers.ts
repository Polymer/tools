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

import {BehaviorOrName, ElementDescriptor, PropertyDescriptor} from '../ast/ast';
import * as astValue from '../javascript/ast-value';

import {analyzeProperties} from './analyze-properties';

export type PropertyHandlers = {
  [key: string]: (node: estree.Node) => void
};

/**
 * Returns an object containing functions that will annotate `declaration` with
 * the polymer-specificmeaning of the value nodes for the named properties.
 *
 * @param  {ElementDescriptor} declaration The descriptor to annotate.
 * @return {object.<string,function>}      An object containing property
 *                                         handlers.
 */
export function declarationPropertyHandlers(declaration: ElementDescriptor):
    PropertyHandlers {
  return {
    is(node: estree.Node) {
      if (node.type === 'Literal') {
        declaration.is = node.value.toString();
      }
    },
    properties(node: estree.Node) {
      for (const prop of analyzeProperties(node)) {
        declaration.properties.push(prop);
      }
    },
    behaviors(node: estree.Node) {
      if (node.type !== 'ArrayExpression') {
        return;
      }
      for (const element of node.elements) {
        let v = astValue.expressionToValue(element);
        if (v === undefined) {
          v = astValue.CANT_CONVERT;
        }
        declaration.behaviors.push(<BehaviorOrName>v);
      }
    },
    observers(node: estree.Node) {
      if (node.type !== 'ArrayExpression') {
        return;
      }
      for (let element of node.elements) {
        let v = astValue.expressionToValue(element);
        if (v === undefined) {
          v = astValue.CANT_CONVERT;
        }
        declaration.observers.push({javascriptNode: element, expression: v});
      }
    }
  };
}
