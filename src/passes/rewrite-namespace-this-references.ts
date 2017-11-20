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
 * Rewrite `this` references to the explicit namespaceReference identifier
 * within a single BlockStatement. Don't traverse deeper into new scopes.
 */
function rewriteSingleScopeThisReferences(
    blockStatement: estree.BlockStatement, namespaceReference: string) {
  astTypes.visit(blockStatement, {
    visitThisExpression(path: NodePath<estree.ThisExpression>) {
      path.replace(jsc.identifier(namespaceReference));
      return false;
    },

    visitFunctionExpression(_path: NodePath<estree.FunctionExpression>) {
      // Don't visit into new scopes
      return false;
    },
    visitFunctionDeclaration(_path: NodePath<estree.FunctionDeclaration>) {
      // Don't visit into new scopes
      return false;
    },
    visitMethodDefinition(_path: NodePath) {
      // Don't visit into new scopes
      return false;
    },
    // Note: we do visit into ArrowFunctionExpressions because they
    //     inherit the containing `this` context.
  });
}


/**
 * Rewrite `this` references that refer to the namespace object. Replace
 * with an explicit reference to the namespace. This simplifies the rest of
 * our transform pipeline by letting it assume that all namespace references
 * are explicit.
 *
 * NOTE(fks): References to the namespace object still need to be corrected
 * after this step, so timing is important: Only run after exports have
 * been created, but before all namespace references are corrected.
 */
function rewriteNamespaceThisReferences(
    program: estree.Program, namespaceName: string) {
  astTypes.visit(program, {
    visitExportNamedDeclaration:
        (path: NodePath<estree.ExportNamedDeclaration>) => {
          if (path.node.declaration &&
              path.node.declaration.type === 'FunctionDeclaration') {
            rewriteSingleScopeThisReferences(
                path.node.declaration.body, namespaceName);
          }
          return false;
        },
    visitExportDefaultDeclaration:
        (path: NodePath<estree.ExportDefaultDeclaration>) => {
          if (path.node.declaration &&
              path.node.declaration.type === 'FunctionDeclaration') {
            rewriteSingleScopeThisReferences(
                path.node.declaration.body, namespaceName);
          }
          return false;
        },
  });
}


/**
 * Rewrite `this` references that refer to the namespace object. Replace
 * with an explicit reference to the namespace. This simplifies the rest of
 * our transform pipeline by letting it assume that all namespace references
 * are explicit.
 *
 * NOTE(fks): References to the namespace object still need to be corrected
 * after this step, so timing is important: Only run after exports have
 * been created, but before all namespace references are corrected.
 */
export function rewriteNamespacesThisReferences(
    program: estree.Program, namespaceNames: Set<string>) {
  for (const namespaceName of namespaceNames) {
    rewriteNamespaceThisReferences(program, namespaceName);
  }
}
