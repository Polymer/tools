/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {getMemberName, getTopLevelStatements} from '../document-util';

/**
 * Get a reference to the callback in a
 * `document.addEventListener("WebComponentsReady", ...)` call expression.
 */
function getWebComponentsReadyCallback(
    memberName: string|undefined,
    callExpression: estree.CallExpression): estree.Node|undefined {
  const args = callExpression.arguments;
  if (args.length !== 2) {
    return;
  }
  if (!(memberName === 'addEventListener' ||
        memberName === 'document.addEventListener')) {
    return;
  }
  const [eventName, callback] = args;
  if (eventName.type !== 'Literal' ||
      eventName.value !== 'WebComponentsReady') {
    return;
  }
  return callback;
}

/**
 * Get a reference to the callback in a
 * `document.addEventListener("HTMLImports.whenReady", ...)` call expression.
 */
function getHtmlImportsReadyCallback(
    memberName: string|undefined,
    callExpression: estree.CallExpression): estree.Node|undefined {
  const args = callExpression.arguments;
  if (args.length !== 1) {
    return;
  }
  if (memberName !== 'HTMLImports.whenReady') {
    return;
  }
  return args[0];
}


/**
 * Unwrap the bodies of any listeners for the `WebComponentsReady` event, or
 * callbacks passed to `HTMLImports.whenReady` as the closest equivalent in
 * modules world happens by default.
 */
export function removeUnnecessaryEventListeners(program: estree.Program) {
  for (const nodePath of getTopLevelStatements(program)) {
    const statement = nodePath.node;
    if (statement.type !== 'ExpressionStatement' ||
        statement.expression.type !== 'CallExpression') {
      continue;
    }
    let memberName = getMemberName(statement.expression.callee);
    if (!memberName && statement.expression.callee.type === 'Identifier') {
      memberName = statement.expression.callee.name;
    }
    const callback =
        getWebComponentsReadyCallback(memberName, statement.expression) ||
        getHtmlImportsReadyCallback(memberName, statement.expression);
    if (!callback) {
      continue;
    }
    if ((callback.type !== 'FunctionExpression' &&
         callback.type !== 'ArrowFunctionExpression')) {
      continue;
    }
    if (callback.body.type !== 'BlockStatement' || callback.async ||
        callback.generator || callback.params.length > 0) {
      return;
    }
    for (const statement of callback.body.body) {
      nodePath.insertBefore(statement);
    }
    nodePath.prune();
  }
}
