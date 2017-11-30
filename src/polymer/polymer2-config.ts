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

import * as babel from 'babel-types';

import * as astValue from '../javascript/ast-value';
import {getIdentifierName} from '../javascript/ast-value';
import {JavaScriptDocument} from '../javascript/javascript-document';

import {analyzeProperties} from './analyze-properties';
import {ScannedPolymerProperty} from './polymer-element';

export function getStaticGetterValue(
    node: babel.ClassDeclaration|babel.ClassExpression,
    name: string): babel.Expression|undefined|null {
  const getter =
      node.body.body.find(
          (n) => babel.isClassMethod(n) && n.static === true &&
              n.kind === 'get' && getIdentifierName(n.key) === name) as
      babel.ClassMethod;
  if (!getter) {
    return undefined;
  }

  // TODO(justinfagnani): consider generating warnings for these checks
  // TODO(usergenic): I'm not sure this conversion below here makes sense...  Do
  // we semantically want this `getter.body` to replace `getter.value.body`?
  const getterBody = getter.body;
  if (getterBody.body.length !== 1) {
    // not a single statement function
    return undefined;
  }
  const statement = getterBody.body[0]!;
  if (!babel.isReturnStatement(statement)) {
    // we only support a return statement
    return undefined;
  }

  return statement.argument;
}

export function getIsValue(node: babel.ClassDeclaration|
                           babel.ClassExpression): string|undefined {
  const getterValue = getStaticGetterValue(node, 'is');
  if (!getterValue || !babel.isLiteral(getterValue)) {
    // we only support literals
    return undefined;
  }
  const value = astValue.expressionToValue(getterValue);
  if (typeof value !== 'string') {
    return undefined;
  }
  return value;
}

/**
 * Returns the properties defined in a Polymer config object literal.
 */
export function getPolymerProperties(
    node: babel.Node, document: JavaScriptDocument): ScannedPolymerProperty[] {
  if (!babel.isClassDeclaration(node) && !babel.isClassExpression(node)) {
    return [];
  }
  const propertiesNode = getStaticGetterValue(node, 'properties');
  return propertiesNode ? analyzeProperties(propertiesNode, document) : [];
}
