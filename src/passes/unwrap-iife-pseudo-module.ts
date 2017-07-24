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

/**
 * If the given program consists of a single IIFE, move its contents up and out,
 * as an ES6 module doesn't need an IIFE to contain its local variables.
 *
 * @param program The program. Is mutated.
 */
export function unwrapIIFEPeusdoModule(program: estree.Program) {
  if (program.body.length !== 1) {
    return;
  }
  const statement = program.body[0];
  if (statement.type !== 'ExpressionStatement' ||
      statement.expression.type !== 'CallExpression') {
    return;
  }
  const callee = statement.expression.callee;
  if ((callee.type !== 'FunctionExpression' &&
       callee.type !== 'ArrowFunctionExpression')) {
    return;
  }
  if (callee.body.type !== 'BlockStatement' || callee.async ||
      callee.generator || callee.params.length > 0) {
    return;
  }
  const body = callee.body.body;
  if (body.length > 0 && isUseStrict(body[0])) {
    program.body = body.slice(1);
  } else {
    program.body = body;
  }
}

/**
 * Returns true if a statement is the literal "use strict".
 */
function isUseStrict(statement: estree.Statement) {
  return statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'Literal' &&
      statement.expression.value === 'use strict';
}
