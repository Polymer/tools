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
import * as dom5 from 'dom5/lib/index-next';
import {Document, ParsedDocument, ParsedHtmlDocument, Severity, SourceRange, Warning} from 'polymer-analyzer';
import * as validate from 'validate-element-name';

import {registry} from '../registry';
import {getDocumentContaining, stripIndentation} from '../util';

import {HtmlRule} from './rule';

const p = dom5.predicates;

class ValidateElementName extends HtmlRule {
  code = 'validate-element-name';
  description = stripIndentation(`
      Warns for invalid element names.
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];

    const elements = document.getFeatures({kind: 'polymer-element'});
    if (elements.size === 0) {
      return warnings;
    }

    for (const el of elements) {
      const isP2 = babel.isClassDeclaration(el.astNode);
      const containingDoc = getDocumentContaining(el.sourceRange, document);
      if (containingDoc === undefined) {
        continue;
      }

      let sourceRange: SourceRange|undefined;
      babelTraverse(el.astNode, {
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
              path.node.static === true) {
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

      if (!el.tagName) {
        warnings.push(new Warning({
          parsedDocument,
          code: 'invalid-element-name',
          severity: Severity.ERROR,
          sourceRange: sourceRange!,
          message: 'Missing element name.'
        }));
        continue;
      }

      const validationResult = validate(el.tagName);
      if (validationResult.isValid && validationResult.message === undefined) {
        continue;
      }

      const isError = !validationResult.isValid;
      warnings.push(new Warning({
        parsedDocument,
        code: isError ? 'invalid-element-name' : 'potential-issue-element-name',
        severity: isError ? Severity.ERROR : Severity.WARNING,
        sourceRange: sourceRange!,
        message: validationResult.message
      }));
    }

    return warnings;
  }
}

registry.register(new ValidateElementName());
