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

import * as babel from 'babel-types';

import {Warning} from '../model/model';

import {getIdentifierName, getNamespacedIdentifier} from './ast-value';
import {Visitor} from './estree-visitor';
import * as esutil from './esutil';
import {JavaScriptDocument} from './javascript-document';
import {JavaScriptScanner} from './javascript-scanner';
import * as jsdoc from './jsdoc';
import {ScannedNamespace} from './namespace';

export class NamespaceScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>) {
    const visitor = new NamespaceVisitor(document);
    await visit(visitor);
    return {
      features: Array.from(visitor.namespaces),
      warnings: visitor.warnings
    };
  }
}

class NamespaceVisitor implements Visitor {
  namespaces = new Set<ScannedNamespace>();
  document: JavaScriptDocument;
  warnings: Warning[] = [];

  constructor(document: JavaScriptDocument) {
    this.document = document;
  }

  /**
   * Look for object declarations with @namespace in the docs.
   */
  enterVariableDeclaration(
      node: babel.VariableDeclaration, _parent: babel.Node) {
    if (node.declarations.length !== 1) {
      return;  // Ambiguous.
    }
    this._initNamespace(node, node.declarations[0].id);
  }

  /**
   * Look for object assignments with @namespace in the docs.
   */
  enterAssignmentExpression(
      node: babel.AssignmentExpression, parent: babel.Node) {
    this._initNamespace(parent, node.left);
  }

  enterObjectProperty(node: babel.ObjectProperty, _parent: babel.Node) {
    this._initNamespace(node, node.key);
  }

  private _initNamespace(node: babel.Node, nameNode: babel.Node) {
    const comment = esutil.getAttachedComment(node);
    // Quickly filter down to potential candidates.
    if (!comment || comment.indexOf('@namespace') === -1) {
      return;
    }
    const analyzedName = getIdentifierName(nameNode);
    const docs = jsdoc.parseJsdoc(comment);
    const namespaceTag = jsdoc.getTag(docs, 'namespace');
    const explicitName = namespaceTag && namespaceTag.name;
    let namespaceName;
    if (explicitName) {
      namespaceName = explicitName;
    } else if (analyzedName) {
      namespaceName = getNamespacedIdentifier(analyzedName, docs);
    } else {
      // TODO(fks): Propagate a warning if name could not be determined
      return;
    }

    const sourceRange = this.document.sourceRangeForNode(node);
    if (!sourceRange) {
      throw new Error(
          `Unable to determine sourceRange for @namespace: ${comment}`);
    }

    const summaryTag = jsdoc.getTag(docs, 'summary');
    const summary = (summaryTag && summaryTag.description) || '';
    const description = docs.description;

    this.namespaces.add(new ScannedNamespace(
        namespaceName, description, summary, node, docs, sourceRange));
  }
}
