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
import {ScannedMethod, ScannedProperty, SourceRange} from '../model/model';
import {Severity, Warning} from '../warning/warning';

import {ScannedPolymerProperty} from './polymer-element';

/**
 * Create a ScannedProperty object from an estree Property AST node.
 */
export function toScannedProperty(
    node: estree.Property|estree.MethodDefinition,
    sourceRange: SourceRange): ScannedProperty {
  const type = closureType(node.value, sourceRange);
  const description =
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

  if (node.kind === 'get' || node.kind === 'set') {
    result.type = '';
  } else if (type === 'Function') {
    const value = <estree.Function>node.value;
    result.function = {
      params: (value.params || []).map((param) => {
        // With ES6 we can have a lot of param patterns. Best to leave the
        // formatting to escodegen.
        return {name: escodegen.generate(param)};
      }),
    };
  }

  return result;
};


/**
 * Create a ScannedMethod object from an estree Property AST node.
 */
export function toScannedMethod(
    node: estree.Property|estree.MethodDefinition,
    sourceRange: SourceRange): ScannedMethod {
  return <ScannedMethod>toScannedProperty(node, sourceRange);
}

/**
 * Create a ScannedPolymerProperty object from an estree Property AST node.
 */
export function toScannedPolymerProperty(
    node: estree.Property, sourceRange: SourceRange): ScannedPolymerProperty {
  const scannedPolymerProperty =
      <ScannedPolymerProperty>toScannedProperty(node, sourceRange);

  if (node.kind === 'get' || node.kind === 'set') {
    node[`${node.kind}ter`] = true;
  }

  return scannedPolymerProperty;
}
