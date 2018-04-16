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

import * as babel from '@babel/types';

import {configurationProperties, getAttachedComment, getClosureType, getOrInferPrivacy, getPropertyName} from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import * as jsdoc from '../javascript/jsdoc';
import {Severity, SourceRange, Warning} from '../model/model';

import {ScannedPolymerProperty} from './polymer-element';

/**
 * Create a ScannedProperty object from an estree Property AST node.
 */
export function toScannedPolymerProperty(
    node: babel.ObjectMethod|babel.ObjectProperty|babel.ClassMethod,
    sourceRange: SourceRange,
    document: JavaScriptDocument): ScannedPolymerProperty|undefined {
  const parsedJsdoc = jsdoc.parseJsdoc(getAttachedComment(node) || '');
  const description = parsedJsdoc.description.trim();
  const maybeName = getPropertyName(node);

  const warnings: Warning[] = [];
  if (!maybeName) {
    warnings.push(new Warning({
      code: 'unknown-prop-name',
      message:
          `Could not determine name of property from expression of type: ` +
          `${node.key.type}`,
      sourceRange: sourceRange,
      severity: Severity.WARNING,
      parsedDocument: document
    }));
    return;
  }

  const value = babel.isObjectProperty(node) ? node.value : node;

  const typeResult = getClosureType(value, parsedJsdoc, sourceRange, document);
  let type;
  if (typeResult.successful) {
    type = typeResult.value;
  } else {
    warnings.push(typeResult.error);
    type = 'Object';
  }

  const name = maybeName || '';
  const result: ScannedPolymerProperty = {
    name,
    type,
    description,
    sourceRange,
    warnings,
    astNode: {node, language: 'js', containingDocument: document},
    isConfiguration: configurationProperties.has(name),
    jsdoc: parsedJsdoc,
    privacy: getOrInferPrivacy(name, parsedJsdoc)
  };

  return result;
};
