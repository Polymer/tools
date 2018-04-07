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


class DomCallsToNative extends Rule {
  code = 'dom-calls-to-native';
  description = stripIndentation(`
      Warns when the Polymer.dom is used in places where native
      methods can now be used instead.

        Polymer.dom(event).path

      Accepted syntax:

        event.composedPath()
  `);

  private _replacements: Map<string, string> = new Map([
    ['localTarget', 'target'],
    ['rootTarget', 'composedPath()[0]'],
    ['path', 'composedPath()']
  ]);

  async check(document: Document) {
    const warnings: Warning[] = [];

    const docs = document.getFeatures({kind: 'js-document'});

    for (const doc of docs) {
      babelTraverse(doc.parsedDocument.ast, {
        noScope: true,
        MemberExpression: (path) => {
          if (!babel.isIdentifier(path.node.property)) {
            return;
          }

          const name = path.node.property.name;
          const replacement = this._replacements.get(name);

          if (!this._isPolymerDomCall(path.node.object) ||
              replacement === undefined) {
            return;
          }

          const containingDoc =
              getDocumentContaining(doc.sourceRange, document);

          if (!containingDoc) {
            return;
          }

          const sourceRange = containingDoc.sourceRangeForNode(path.node);
          if (sourceRange === undefined) {
            return;
          }

          warnings.push(new Warning({
            parsedDocument: document.parsedDocument,
            code: 'deprecated-dom-call',
            severity: Severity.WARNING, sourceRange,
            message: stripWhitespace(`
              Polymer.dom no longer needs to be called for "${name}",
              instead "event.${replacement}" may be used.
            `)
          }));
        }
      });
    }

    return warnings;
  }

  private _isPolymerDomCall(expr: babel.Expression): boolean {
    return babel.isCallExpression(expr) &&
        babel.isMemberExpression(expr.callee) &&
        babel.isIdentifier(expr.callee.object) &&
        babel.isIdentifier(expr.callee.property) &&
        expr.callee.object.name === 'Polymer' &&
        expr.callee.property.name === 'dom';
  }
}

registry.register(new DomCallsToNative());
