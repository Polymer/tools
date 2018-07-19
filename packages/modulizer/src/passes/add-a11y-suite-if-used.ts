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

import * as astTypes from 'ast-types';
import {NodePath} from 'ast-types';
import * as estree from 'estree';
import * as jsc from 'jscodeshift';

/**
 * Rewrite references in a program from their original names to the local names
 * based on the new named exports system.
 *
 * TODO(fks): This standalone A11ySuite handling could be brought into normal
 * `collectNamespacedReferences()` logic if we added `A11ySuite()` to the known
 * export graph.
 */
export function addA11ySuiteIfUsed(
    program: estree.Program, a11ySuiteUrl: string): boolean {
  let isFound = false;
  astTypes.visit(program, {
    visitCallExpression(path: NodePath<estree.CallExpression>) {
      const callee = path.node.callee as estree.Identifier;
      const name = callee.name;
      if (name === 'a11ySuite') {
        isFound = true;
        this.abort();
      }
      this.traverse(path);
    }
  });

  if (!isFound) {
    return false;
  }

  program.body.unshift(jsc.importDeclaration(
      [jsc.importSpecifier(jsc.identifier('a11ySuite'))],
      jsc.literal(a11ySuiteUrl)));
  return true;
}
