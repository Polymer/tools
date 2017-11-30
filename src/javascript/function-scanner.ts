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
import * as doctrine from 'doctrine';

import {Warning} from '../model/model';
import {comparePosition} from '../model/source-range';

import {getIdentifierName, getNamespacedIdentifier} from './ast-value';
import {Visitor} from './estree-visitor';
import {getAttachedComment, getOrInferPrivacy, objectKeyToString} from './esutil';
import {ScannedFunction} from './function';
import {JavaScriptDocument} from './javascript-document';
import {JavaScriptScanner} from './javascript-scanner';
import * as jsdoc from './jsdoc';

export class FunctionScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>) {
    const visitor = new FunctionVisitor(document);
    await visit(visitor);
    return {
      features: Array.from(visitor.functions)
                    .sort(
                        (a, b) => comparePosition(
                            a.sourceRange.start, b.sourceRange.start)),
    };
  }
}

class FunctionVisitor implements Visitor {
  functions = new Set<ScannedFunction>();
  document: JavaScriptDocument;
  warnings: Warning[] = [];

  constructor(document: JavaScriptDocument) {
    this.document = document;
  }

  /**
   * Scan standalone function declarations.
   */
  enterFunctionDeclaration(
      node: babel.FunctionDeclaration, _parent: babel.Node) {
    this._initFunction(node, getIdentifierName(node.id), node);
    return;
  }

  /**
   * Scan object method declarations.
   */
  enterObjectMethod(node: babel.ObjectMethod, _parent: babel.Node) {
    this._initFunction(node, getIdentifierName(node.key), node);
    return;
  }

  /**
   * Scan functions assigned to newly declared variables.
   */
  enterVariableDeclaration(
      node: babel.VariableDeclaration, _parent: babel.Node) {
    if (node.declarations.length !== 1) {
      return;  // Ambiguous.
    }
    const declaration = node.declarations[0];
    const declarationId = declaration.id;
    const declarationValue = declaration.init;
    if (declarationValue && babel.isFunction(declarationValue)) {
      return this._initFunction(
          node, objectKeyToString(declarationId), declarationValue);
    }
  }

  /**
   * Scan functions assigned to variables and object properties.
   */
  enterAssignmentExpression(
      node: babel.AssignmentExpression, parent: babel.Node) {
    if (babel.isFunction(node.right)) {
      this._initFunction(parent, objectKeyToString(node.left), node.right);
    }
  }

  /**
   * Scan functions defined inside of object literals.
   */
  enterObjectExpression(node: babel.ObjectExpression, _parent: babel.Node) {
    for (let i = 0; i < node.properties.length; i++) {
      const prop = node.properties[i];
      if (babel.isSpreadProperty(prop)) {
        continue;
      }
      const propValue = prop.value;
      const name = objectKeyToString(prop.key);
      if (babel.isFunction(propValue)) {
        this._initFunction(prop, name, propValue);
        continue;
      }
      const comment = getAttachedComment(prop) || '';
      const docs = jsdoc.parseJsdoc(comment);
      if (jsdoc.getTag(docs, 'function')) {
        this._initFunction(prop, name);
        continue;
      }
    }
  }

  private _initFunction(
      node: babel.Node, analyzedName?: string, _fn?: babel.Function) {
    const comment = getAttachedComment(node);
    if (!comment) {
      return;
    }
    const docs = jsdoc.parseJsdoc(comment);

    // The @function annotation can override the name.
    const functionTag = jsdoc.getTag(docs, 'function');
    if (functionTag && functionTag.name) {
      analyzedName = functionTag.name;
    }

    if (!analyzedName) {
      // TODO(fks): Propagate a warning if name could not be determined
      return;
    }

    if (!jsdoc.hasTag(docs, 'global') && !jsdoc.hasTag(docs, 'memberof')) {
      // Without this check we would emit a lot of functions not worthy of
      // inclusion. Since we don't do scope analysis, we can't tell when a
      // function is actually part of an exposed API. Only include functions
      // that are explicitly @global, or declared as part of some namespace
      // with @memberof.
      return;
    }

    // TODO(justinfagnani): remove polymerMixin support
    if (jsdoc.hasTag(docs, 'mixinFunction') ||
        jsdoc.hasTag(docs, 'polymerMixin')) {
      // This is a mixin, not a normal function.
      return;
    }

    const functionName = getNamespacedIdentifier(analyzedName, docs);
    const sourceRange = this.document.sourceRangeForNode(node)!;
    const returnTag = jsdoc.getTag(docs, 'return');
    const summaryTag = jsdoc.getTag(docs, 'summary');
    const summary = (summaryTag && summaryTag.description) || '';
    const description = docs.description;

    let functionReturn;
    if (returnTag) {
      functionReturn = {
        type: returnTag.type ? doctrine.type.stringify(returnTag.type) :
                               undefined,
        desc: returnTag.description || '',
      };
    }

    // TODO(justinfagnani): consolidate with similar param processing code in
    // docs.ts
    const functionParams: {type: string, desc: string, name: string}[] = [];
    if (docs.tags) {
      docs.tags.forEach((tag) => {
        if (tag.title !== 'param') {
          return;
        }
        functionParams.push({
          type: tag.type ? doctrine.type.stringify(tag.type) : 'N/A',
          desc: tag.description || '',
          name: tag.name || 'N/A'
        });
      });
    }
    // TODO(fks): parse params directly from `fn`, merge with docs.tags data

    const specificName = functionName.slice(functionName.lastIndexOf('.') + 1);
    this.functions.add(new ScannedFunction(
        functionName,
        description,
        summary,
        getOrInferPrivacy(specificName, docs),
        node,
        docs,
        sourceRange,
        functionParams,
        functionReturn));
  }
}
