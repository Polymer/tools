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
import * as estree from 'estree';
import {getMemberOrIdentifierName} from '../document-util';

/**
 * Detect certain types of expressions that we deem noops when looking for
 * namespace initializers. For example, `var namespace = window.namespace`.
 */
function isNoopInitializationValue(
    expression: estree.Expression, assigningTo: string): boolean {
  // `foo || bar` is a noop if both `foo` and `bar` are.
  if (expression.type === 'LogicalExpression' && expression.operator === '||') {
    return isNoopInitializationValue(expression.left, assigningTo) &&
        isNoopInitializationValue(expression.right, assigningTo);
  }
  // `{}` is the default empty value for a namespace.
  if (expression.type === 'ObjectExpression' &&
      expression.properties.length === 0) {
    return true;
  }
  // `var namespace = window.namespace` is also a noop initialization
  if (getMemberOrIdentifierName(expression) === assigningTo) {
    return true;
  }
  // Most expressions are not noop initializations.
  return false;
}

/**
 * Remove initializers for a set of namespaces in a program.
 */
export function removeNamespaceInitializers(
    program: estree.Program, namespaces: ReadonlySet<string|undefined>) {
  const handleAssignment =
      (path: astTypes.NodePath,
       left: estree.Node,
       right: estree.Expression) => {
        const memberName = getMemberOrIdentifierName(left);
        if (!namespaces.has(memberName)) {
          return;
        }
        if (isNoopInitializationValue(right, memberName!)) {
          // Don't emit a noop assignment.
          path.prune();
        }
      };

  astTypes.visit(program, {
    visitVariableDeclarator(
        path: astTypes.NodePath<estree.VariableDeclarator>) {
      if (path.node.init != null) {
        handleAssignment(path, path.node.id, path.node.init);
      }
      return false;
    },
    visitAssignmentExpression(
        path: astTypes.NodePath<estree.AssignmentExpression>) {
      if (path.node.operator !== '=') {
        return false;
      }
      handleAssignment(path, path.node.left, path.node.right);
      return false;
    }
  });
}
