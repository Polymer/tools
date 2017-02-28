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
import {ScannedMethod} from '../model/model';

import {analyzeProperties} from './analyze-properties';
import * as docs from './docs';
import {toScannedMethod} from './js-utils';
import {ScannedPolymerProperty} from './polymer-element';

function getStaticGetterValue(
    node: estree.ClassDeclaration|estree.ClassExpression,
    name: string): estree.Expression|undefined {
  const candidates = node.body.body.filter(
      (n) => n.type === 'MethodDefinition' && n.static === true &&
          n.kind === 'get' && getIdentifierName(n.key) === name);
  const getter = candidates.length === 1 && candidates[0];
  if (!getter) {
    return undefined;
  }

  // TODO(justinfagnani): consider generating warnings for these checks
  const getterBody = getter.value.body;
  if (getterBody.body.length !== 1) {
    // not a single statement function
    return undefined;
  }
  if (getterBody.body[0].type !== 'ReturnStatement') {
    // we only support a return statement
    return undefined;
  }

  const returnStatement = getterBody.body[0] as estree.ReturnStatement;
  return returnStatement.argument;
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
export function getProperties(
    node: estree.ClassDeclaration|estree.ClassExpression,
    document: JavaScriptDocument): ScannedPolymerProperty[] {
  const propertiesNode = getStaticGetterValue(node, 'properties');
  return propertiesNode ? analyzeProperties(propertiesNode, document) : [];
}

export function getMethods(
    node: estree.ClassDeclaration|estree.ClassExpression,
    document: JavaScriptDocument): ScannedMethod[] {
  return node.body.body
      .filter(
          (n) => n.type === 'MethodDefinition' && n.static === false &&
              n.kind === 'method')
      .map((m) => {
        return docs.annotate(
            toScannedMethod(m, document.sourceRangeForNode(m)!));
      });
}