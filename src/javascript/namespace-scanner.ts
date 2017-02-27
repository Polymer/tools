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

import * as estree from 'estree';

import {getIdentifierName, getNamespacedIdentifier} from '../javascript/ast-value';
import {Visitor} from '../javascript/estree-visitor';
import * as esutil from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptScanner} from '../javascript/javascript-scanner';
import * as jsdoc from '../javascript/jsdoc';
import {ScannedNamespace} from './namespace';

export class NamespaceScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>): Promise<ScannedNamespace[]> {
    const visitor = new NamespaceVisitor(document);
    await visit(visitor);
    return Array.from(visitor.namespaces);
  }
}

class NamespaceVisitor implements Visitor {
  namespaces = new Set<ScannedNamespace>();
  document: JavaScriptDocument;

  constructor(document: JavaScriptDocument) {
    this.document = document;
  }

  /**
   * Look for object declarations with @namespace in the docs.
   */
  enterVariableDeclaration(
      node: estree.VariableDeclaration, _parent: estree.Node) {
    if (node.declarations.length !== 1) {
      return;  // Ambiguous.
    }
    const variableName = getIdentifierName(node.declarations[0].id);
    this._initNamespace(node, variableName);
  }

  /**
   * Look for object assignments with @namespace in the docs.
   */
  enterAssignmentExpression(
      node: estree.AssignmentExpression, parent: estree.Node) {
    const assignmentName = getIdentifierName(node.left);
    this._initNamespace(parent, assignmentName);
  }

  private _initNamespace(node: estree.Node, anaylzedName?: string) {
    const comment = esutil.getAttachedComment(node);
    // Quickly filter down to potential candidates.
    if (!comment || comment.indexOf('@namespace') === -1) {
      return;
    }

    const docs = jsdoc.parseJsdoc(comment);
    const explicitName = jsdoc.getTag(docs, 'namespace', 'name');
    let namespaceName;
    if (explicitName) {
      namespaceName = explicitName;
    } else if (anaylzedName) {
      namespaceName = getNamespacedIdentifier(anaylzedName, docs);
    } else {
      // TODO(fks): Propagate a warning if name could not be determined
      return;
    }

    const sourceRange = this.document.sourceRangeForNode(node);
    if (!sourceRange) {
      throw new Error(
          `Unable to determine sourceRange for @namespace: ${comment}`);
    }

    this.namespaces.add(
        new ScannedNamespace(namespaceName, node, docs, sourceRange));
  }
}
