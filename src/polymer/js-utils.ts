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
import {Privacy, ScannedMethod, SourceRange} from '../model/model';
import {Severity, Warning} from '../warning/warning';

import {ScannedPolymerProperty} from './polymer-element';

/**
 * Create a ScannedProperty object from an estree Property AST node.
 */
export function toScannedPolymerProperty(
    node: estree.Property|estree.MethodDefinition,
    sourceRange: SourceRange): ScannedPolymerProperty {
  const type = closureType(node.value, sourceRange);
  const parsedJsdoc = jsdoc.parseJsdoc(getAttachedComment(node) || '');
  const description =
      jsdoc.removeLeadingAsterisks(getAttachedComment(node) || '').trim();
  const maybeName = objectKeyToString(node.key);

  const warnings: Warning[] = [];
  if (!maybeName) {
    warnings.push({
      code: 'unknown-prop-name',
      message:
          `Could not determine name of property from expression of type: ${node
              .key.type}`,
      sourceRange: sourceRange,
      severity: Severity.WARNING
    });
  }
  const name = maybeName || '';
  const result: ScannedPolymerProperty = {
    name,
    type,
    description,
    sourceRange,
    warnings,
    astNode: node,
    isConfiguration: configurationProperties.has(name),
    jsdoc: parsedJsdoc,
    privacy: getOrInferPrivacy(name, parsedJsdoc, false)
  };

  return result;
};

/**
 * Properties on Polymer element prototypes that are part of Polymer's
 * configuration syntax.
 */
const configurationProperties = new Set([
  'attached',
  'attributeChanged',
  'beforeRegister',
  'configure',
  'constructor',
  'created',
  'detached',
  'enableCustomStyleProperties',
  'extends',
  'hostAttributes',
  'is',
  'listeners',
  'mixins',
  'observers',
  'properties',
  'ready',
  'registered',
]);

/**
 * Create a ScannedMethod object from an estree Property AST node.
 */
export function toScannedMethod(
    node: estree.Property|estree.MethodDefinition,
    sourceRange: SourceRange): ScannedMethod {
  const scannedMethod: ScannedMethod =
      toScannedPolymerProperty(node, sourceRange);

  if (scannedMethod.type === 'Function' ||
      scannedMethod.type === 'ArrowFunction') {
    const value = <estree.FunctionExpression>node.value;
    scannedMethod.params = (value.params || []).map((param) => {
      // With ES6 we can have a lot of param patterns. Best to leave the
      // formatting to escodegen.
      return {name: escodegen.generate(param)};
    });
  }

  return scannedMethod;
}


export function getOrInferPrivacy(
    name: string,
    annotation: jsdoc.Annotation|undefined,
    privateUnlessDocumented: boolean): Privacy {
  const explicitPrivacy = jsdoc.getPrivacy(annotation);
  const specificName = name.slice(name.lastIndexOf('.') + 1);

  if (explicitPrivacy) {
    return explicitPrivacy;
  } else if (specificName.startsWith('__')) {
    return 'private';
  } else if (specificName.startsWith('_')) {
    return 'protected';
  } else if (specificName.endsWith('_')) {
    return 'private';
  } else if (configurationProperties.has(specificName)) {
    return 'protected';
  } else {
    if (privateUnlessDocumented) {
      // Some members, like methods or properties on classes are private by
      // default unless they have documentation.
      const hasDocs = !!annotation && !jsdoc.isAnnotationEmpty(annotation);
      return hasDocs ? 'public' : 'private';
    } else {
      // Other members, like entries in the Polymer `properties` block are
      // public unless there are clear signals otherwise.
      return 'public';
    }
  }
}
