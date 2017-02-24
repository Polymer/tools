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
import {getPropertyValue} from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';

import {analyzeProperties} from './analyze-properties';
import {ScannedPolymerProperty} from './polymer-element';

export function getIsValue(node: estree.ClassDeclaration|
                           estree.ClassExpression): string|undefined {
  const possibleIsGetters = node.body.body.filter(
      (n) => n.type === 'MethodDefinition' && n.static === true &&
          n.kind === 'get' && getIdentifierName(n.key) === 'is');
  const isGetter = possibleIsGetters.length === 1 && possibleIsGetters[0];
  if (!isGetter) {
    return undefined;
  }

  // TODO(justinfagnani): consider generating warnings for these checks
  const isGetterBody = isGetter.value.body;
  if (isGetterBody.body.length !== 1) {
    // not a single statement function
    return undefined;
  }
  if (isGetterBody.body[0].type !== 'ReturnStatement') {
    // we only support a return statement
    return undefined;
  }

  const returnStatement = isGetterBody.body[0] as estree.ReturnStatement;
  const returnValue = returnStatement.argument;
  if (!returnValue || returnValue.type !== 'Literal') {
    // we only support literals
    return undefined;
  }
  if (typeof returnValue.value !== 'string') {
    return undefined;
  }
  return returnValue.value;
}

/**
 * Returns the object literal that defines a Polymer element configuration from
 * a Polymer element class.
 */
export function getConfig(node: estree.ClassDeclaration|estree.ClassExpression):
    estree.ObjectExpression|null {
  const possibleConfigs = node.body.body.filter(
      (n) => n.type === 'MethodDefinition' && n.static === true &&
          n.kind === 'get' && getIdentifierName(n.key) === 'config');
  const config = possibleConfigs.length === 1 && possibleConfigs[0];
  if (!config) {
    return null;
  }

  const configBody = config.value.body;
  if (configBody.body.length !== 1) {
    // not a single statement function
    return null;
  }
  if (configBody.body[0].type !== 'ReturnStatement') {
    // we only support a return statement
    return null;
  }

  const returnStatement = configBody.body[0] as estree.ReturnStatement;
  const returnValue = returnStatement.argument;
  if (!returnValue || returnValue.type !== 'ObjectExpression') {
    // we only support object literals
    return null;
  }
  return returnValue;
}

/**
 * Returns the properties defined in a Polymer config object literal.
 */
export function getProperties(
    node: estree.ObjectExpression,
    document: JavaScriptDocument): ScannedPolymerProperty[] {
  const propertiesNode = getPropertyValue(node, 'properties');
  return propertiesNode ? analyzeProperties(propertiesNode, document) : [];
}
