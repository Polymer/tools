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
import {getDocumentContaining, stripIndentation, stripWhitespace} from '../util';


class CreateElementExtension extends Rule {
  code = 'create-element-extension';
  description = stripIndentation(`
    Warns when using the second parameter of createElement for element extension using the is attribute.
  `);

  async check(document: Document) {
    const warnings: Warning[] = [];

    const docs = document.getFeatures({kind: 'js-document'});

    for (const doc of docs) {
      babelTraverse(doc.parsedDocument.ast, {
        noScope: true,
        CallExpression: (path) => {
          if (!this.isExtendingElementCall(path.node)) {
            return;
          }

          const containingDoc =
              getDocumentContaining(doc.sourceRange, document);
          if (containingDoc === undefined) {
            return;
          }

          const sourceRange =
              containingDoc.sourceRangeForNode(path.node.arguments[1]);
          if (sourceRange === undefined) {
            return;
          }

          if (babel.isStringLiteral(path.node.arguments[1])) {
            warnings.push(new Warning({
              parsedDocument: document.parsedDocument,
              code: 'create-element-string-extension',
              severity: Severity.WARNING, sourceRange,
              message: stripWhitespace(`
                document.createElement with a custom element tagname as the second parameter is deprecated.
              `)
            }));
          } else {
            warnings.push(new Warning({
              parsedDocument: document.parsedDocument,
              code: 'create-element-is-property-extension',
              severity: Severity.WARNING, sourceRange,
              message: stripWhitespace(`
                Creating a custom element extension of a built-in element is not widely supported, and is not recommended.
              `)
            }));
          }
        },
      });
    }

    return warnings;
  }

  private isExtendingElementCall(expr: babel.Expression): boolean {
    return babel.isCallExpression(expr) &&
        babel.isMemberExpression(expr.callee) &&
        babel.isIdentifier(expr.callee.object) &&
        expr.callee.object.name === 'document' &&
        babel.isIdentifier(expr.callee.property) &&
        expr.callee.property.name === 'createElement' &&
        expr.arguments.length === 2;
  }
}

registry.register(new CreateElementExtension());