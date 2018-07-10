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

import {getMemberPath} from '../document-util';


/**
 * Rewrites local references to a namespace member, ie:
 *
 * const NS = {
 *   foo() {}
 * }
 * NS.foo();
 *
 * to:
 *
 * export foo() {}
 * foo();
 */
export function rewriteReferencesToNamespaceMembers(
    program: estree.Program, namespaceNames: ReadonlySet<string>) {
  astTypes.visit(program, {
    visitMemberExpression(path: NodePath<estree.MemberExpression>) {
      const memberPath = getMemberPath(path.node);
      if (memberPath) {
        const namespace = memberPath.slice(0, -1).join('.');
        if (namespaceNames.has(namespace)) {
          path.replace(path.node.property);
          return false;
        }
      }
      // Keep looking, this MemberExpression could still contain the
      // MemberExpression that we are looking for.
      this.traverse(path);
      return;
    }
  });
}
