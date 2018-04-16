/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

import babelTraverse from 'babel-traverse';
import * as babel from 'babel-types';
import {Document, Severity, Warning} from 'polymer-analyzer';

import {registry} from '../registry';
import {Rule} from '../rule';
import {getDocumentContaining, stripIndentation} from '../util';

import validate = require('validate-element-name');

class ValidateElementName extends Rule {
  code = 'validate-element-name';
  description = stripIndentation(`
      Warns for invalid element names.
  `);

  async check(document: Document) {
    const warnings: Warning[] = [];

    const elements = document.getFeatures({kind: 'polymer-element'});
    if (elements.size === 0) {
      return warnings;
    }

    for (const el of elements) {
      if (el.tagName === undefined) {
        continue;
      }

      const containingDoc = getDocumentContaining(el.sourceRange, document);
      if (containingDoc === undefined) {
        continue;
      }

      const validationResult = validate(el.tagName);
      if (validationResult.isValid && validationResult.message === undefined) {
        continue;  // Valid element
      }

      if (el.astNode === undefined || el.astNode.language !== 'js') {
        continue;
      }

      const isP2 = babel.isClassDeclaration(el.astNode.node);
      let sourceRange = el.sourceRange;
      babelTraverse(el.astNode.node, {
        noScope: true,
        ObjectProperty(path) {
          if (isP2) {
            return;
          }
          if (babel.isIdentifier(path.node.key) &&
              path.node.key.name === 'is' &&
              babel.isStringLiteral(path.node.value)) {
            sourceRange = containingDoc.sourceRangeForNode(path.node.value);
          }
        },
        ClassMethod(path) {
          if (!isP2) {
            return;
          }
          if (babel.isIdentifier(path.node.key) &&
              path.node.key.name === 'is' && path.node.kind === 'get' &&
              path.node.static) {
            const body = path.node.body.body[0];
            if (babel.isReturnStatement(body) &&
                babel.isStringLiteral(body.argument)) {
              sourceRange = containingDoc.sourceRangeForNode(body.argument);
            }
          }
        }
      });
      if (sourceRange === undefined) {
        continue;
      }

      const isError = !validationResult.isValid;
      warnings.push(new Warning({
        parsedDocument: document.parsedDocument,
        code: isError ? 'invalid-element-name' :
                        'potential-element-naming-issue',
        severity: isError ? Severity.ERROR : Severity.WARNING,
        sourceRange: sourceRange,
        message: validationResult.message!
      }));
    }

    return warnings;
  }
}

registry.register(new ValidateElementName());
