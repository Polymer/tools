/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {getIdentifierName} from '../javascript/ast-value';
import {JavaScriptDocument} from '../javascript/javascript-document';

import {analyzeProperties} from './analyze-properties';
import {ScannedPolymerProperty} from './polymer-element';

export function getStaticGetterValue(
    node: estree.ClassDeclaration|estree.ClassExpression,
    name: string): estree.Expression|undefined {
  const getter = node.body.body.find(
      (n) => n.type === 'MethodDefinition' && n.static === true &&
          n.kind === 'get' && getIdentifierName(n.key) === name);
  if (!getter) {
    return undefined;
  }

  // TODO(justinfagnani): consider generating warnings for these checks
  const getterBody = getter.value.body;
  if (getterBody.body.length !== 1) {
    // not a single statement function
    return undefined;
  }
  const statement = getterBody.body[0]!;
  if (statement.type !== 'ReturnStatement') {
    // we only support a return statement
    return undefined;
  }

  return statement.argument;
}

export function getIsValue(node: estree.ClassDeclaration|
                           estree.ClassExpression): string|undefined {
  const getterValue = getStaticGetterValue(node, 'is');
  if (!getterValue || getterValue.type !== 'Literal') {
    // we only support literals
    return undefined;
  }
  if (typeof getterValue.value !== 'string') {
    return undefined;
  }
  return getterValue.value;
}

/**
 * Returns the properties defined in a Polymer config object literal.
 */
export function getPolymerProperties(
    node: estree.Node, document: JavaScriptDocument): ScannedPolymerProperty[] {
  if (node.type !== 'ClassDeclaration' && node.type !== 'ClassExpression') {
    return [];
  }
  const propertiesNode = getStaticGetterValue(node, 'properties');
  return propertiesNode ? analyzeProperties(propertiesNode, document) : [];
}
