/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import * as escodegen from 'escodegen';
import * as estree from 'estree';

import {closureType, getAttachedComment, objectKeyToString} from '../javascript/esutil';
import * as jsdoc from '../javascript/jsdoc';
import {SourceRange} from '../model/model';
import {Severity, Warning} from '../warning/warning';

import {ScannedFunction, ScannedPolymerProperty} from './polymer-element';


/**
 * Converts a estree Property AST node into its Hydrolysis representation.
 */
export function toScannedPolymerProperty(
    node: estree.Property, sourceRange: SourceRange): ScannedPolymerProperty {
  let type = closureType(node.value, sourceRange);
  if (type === 'Function') {
    if (node.kind === 'get' || node.kind === 'set') {
      type = '';
      node[`${node.kind}ter`] = true;
    }
  }
  let description =
      jsdoc.removeLeadingAsterisks(getAttachedComment(node) || '').trim();

  const name = objectKeyToString(node.key);

  const warnings: Warning[] = [];
  if (!name) {
    warnings.push({
      code: 'unknown-prop-name',
      message:
          `Could not determine name of property from expression of type: ${node
              .key.type}`,
      sourceRange: sourceRange,
      severity: Severity.WARNING
    });
  }

  const result: ScannedPolymerProperty = {
    name: name || '',
    type: type,
    description: description,
    sourceRange: sourceRange,
    astNode: node, warnings
  };

  if (type === 'Function') {
    const value = <estree.Function>node.value;
    (<ScannedFunction><any>result).params =
        (value.params || []).map((param) => {
          // With ES6 we can have a lot of param patterns. Best to leave the
          // formatting to escodegen.
          return {name: escodegen.generate(param)};
        });
  }

  return result;
}
