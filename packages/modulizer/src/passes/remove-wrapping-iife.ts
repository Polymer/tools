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
import {getTopLevelStatements} from '../document-util';

/**
 * Returns true if a statement is the literal "use strict".
 */
function isUseStrict(statement: estree.Statement) {
  return statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'Literal' &&
      statement.expression.value === 'use strict';
}

/**
 * Unwrap toplevel IIFEs.
 *
 * An ES6 module doesn't need IIFEs to contain its local variables.
 */
export function removeWrappingIIFEs(program: estree.Program) {
  for (const path of getTopLevelStatements(program)) {
    const statement = path.node;
    if (statement.type !== 'ExpressionStatement' ||
        statement.expression.type !== 'CallExpression') {
      continue;
    }
    const callee = statement.expression.callee;
    if ((callee.type !== 'FunctionExpression' &&
         callee.type !== 'ArrowFunctionExpression')) {
      continue;
    }
    if (callee.body.type !== 'BlockStatement' || callee.async ||
        callee.generator || callee.params.length > 0) {
      continue;
    }
    for (const bodyStatement of callee.body.body) {
      if (isUseStrict(bodyStatement)) {
        continue;
      }
      path.insertBefore(bodyStatement);
    }
    path.prune();
  }
}
