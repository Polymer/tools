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
import {Iterable as IterableX} from 'ix';
import * as jsc from 'jscodeshift';

import {getMemberName} from '../document-util';
import {NamespaceMemberToExport} from '../js-module';

/**
 * Rewrite references in a program from their original names to the local names
 * based on the new named exports system.
 */
export function rewriteReferencesToLocalExports(
    program: estree.Program,
    exportMigrationRecords: Iterable<NamespaceMemberToExport>) {
  const rewriteMap = new Map<string|undefined, string>(
      IterableX.from(exportMigrationRecords)
          .filter((m) => m.es6ExportName !== '*')
          .map(
              (m) => [m.oldNamespacedName,
                      m.es6ExportName] as [string, string]));
  astTypes.visit(program, {
    visitMemberExpression(path: NodePath<estree.MemberExpression>) {
      const memberName = getMemberName(path.node);
      const newLocalName = rewriteMap.get(memberName);
      if (newLocalName) {
        path.replace(jsc.identifier(newLocalName));
        return false;
      }
      this.traverse(path);
      return;
    }
  });
}
