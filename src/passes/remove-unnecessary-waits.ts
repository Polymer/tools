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

import {getMemberName, toplevelStatements} from '../util';

/**
 * Unwrap the bodies of any listeners for the `WebComponentsReady` event, as
 * the closest equivalent in modules world happens by default.
 *
 * @param program The program. Is mutated.
 */
export function removeUnnecessaryEventListeners(program: estree.Program) {
  for (const nodePath of toplevelStatements(program)) {
    const statement = nodePath.node;
    if (statement.type !== 'ExpressionStatement' ||
        statement.expression.type !== 'CallExpression') {
      continue;
    }
    const args = statement.expression.arguments;
    if (args.length !== 2) {
      continue;
    }
    const callee = statement.expression.callee;
    let memberName = getMemberName(callee);
    if (!memberName && callee.type === 'Identifier') {
      memberName = callee.name;
    }
    if (!(memberName === 'addEventListener' ||
          memberName === 'document.addEventListener')) {
      continue;
    }
    const [eventName, callback] = args;
    if (eventName.type !== 'Literal' ||
        eventName.value !== 'WebComponentsReady') {
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
