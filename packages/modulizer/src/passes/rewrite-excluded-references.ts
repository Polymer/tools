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

import {ConversionSettings} from '../conversion-settings';
import {getMemberPath, getPathOfAssignmentTo} from '../document-util';


/**
 * Returns true iff the given NodePath is assigned to in an assignment
 * expression.
 */
function isAssigningTo(path: NodePath): boolean {
  return getPathOfAssignmentTo(path) !== undefined;
}

/**
 * Rewrite references in _referenceExcludes and well known properties that
 * don't work well in modular code.
 */
export function rewriteExcludedReferences(
    program: estree.Program, settings: ConversionSettings) {
  const mapOfRewrites = new Map(settings.referenceRewrites);
  for (const reference of settings.referenceExcludes) {
    mapOfRewrites.set(reference, jsc.identifier('undefined'));
  }

  /**
   * Rewrite the given path of the given member by `mapOfRewrites`.
   *
   * Never rewrite an assignment to assign to `undefined`.
   */
  const rewrite = (path: NodePath, memberName: string) => {
    const replacement = mapOfRewrites.get(memberName);
    if (replacement) {
      if (replacement.type === 'Identifier' &&
          replacement.name === 'undefined' && isAssigningTo(path)) {
        /**
         * If `path` is a name / pattern that's being written to, we don't
         * want to rewrite it to `undefined`.
         */
        return;
      }
      path.replace(replacement);
    }
  };

  astTypes.visit(program, {
    visitMemberExpression(path: NodePath<estree.MemberExpression>) {
      const memberPath = getMemberPath(path.node);
      if (memberPath !== undefined) {
        rewrite(path, memberPath.join('.'));
      }
      this.traverse(path);
    },
  });
}
