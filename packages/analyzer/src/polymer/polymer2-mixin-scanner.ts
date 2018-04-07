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

import {NodePath} from '@babel/traverse';
import * as babel from '@babel/types';

import {getIdentifierName, getNamespacedIdentifier} from '../javascript/ast-value';
import {extractPropertiesFromClass} from '../javascript/class-scanner';
import {Visitor} from '../javascript/estree-visitor';
import * as esutil from '../javascript/esutil';
import {getMethods, getOrInferPrivacy, getStaticMethods} from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import * as jsdoc from '../javascript/jsdoc';
import {Warning} from '../model/model';

import {ScannedPolymerElementMixin} from './polymer-element-mixin';
import {getPolymerProperties} from './polymer2-config';

export class MixinVisitor implements Visitor {
  mixins: ScannedPolymerElementMixin[] = [];
  private _document: JavaScriptDocument;

  private _currentMixin: ScannedPolymerElementMixin|null = null;
  private _currentMixinNode: babel.Node|null = null;
  private _currentMixinFunction: babel.Function|null = null;
  readonly warnings: Warning[] = [];

  constructor(document: JavaScriptDocument) {
    this._document = document;
  }

  enterAssignmentExpression(
      node: babel.AssignmentExpression, _parent: babel.Node, path: NodePath) {
    this.tryInitializeMixin(path, node.left);
  }

  enterFunctionDeclaration(
      node: babel.FunctionDeclaration, _parent: babel.Node, path: NodePath) {
    this.tryInitializeMixin(path, node.id);
  }

  leaveFunctionDeclaration(
      node: babel.FunctionDeclaration, _parent: babel.Node) {
    this.clearOnLeave(node);
  }

  enterVariableDeclaration(
      node: babel.VariableDeclaration, _parent: babel.Node, path: NodePath) {
    this.tryInitializeMixin(path, node.declarations[0].id);
  }

  leaveVariableDeclaration(
      node: babel.VariableDeclaration, _parent: babel.Node) {
    this.clearOnLeave(node);
  }

  private tryInitializeMixin(nodePath: NodePath, nameNode: babel.LVal) {
    const comment = esutil.getBestComment(nodePath);
    if (comment === undefined) {
      return;
    }
    const docs = jsdoc.parseJsdoc(comment);
    if (!hasMixinFunctionDocTag(docs)) {
      return;
    }
    const node = nodePath.node;
    const name = getIdentifierName(nameNode);
    const namespacedName =
        name ? getNamespacedIdentifier(name, docs) : undefined;
    if (namespacedName === undefined) {
      // TODO(#903): Warn about a mixin whose name we can't infer?
      return;
    }
    const sourceRange = this._document.sourceRangeForNode(node)!;
    const summaryTag = jsdoc.getTag(docs, 'summary');
    const mixin = new ScannedPolymerElementMixin({
      name: namespacedName,
      sourceRange,
      astNode: node,
      statementAst: esutil.getCanonicalStatement(nodePath),
      description: docs.description,
      summary: (summaryTag && summaryTag.description) || '',
      privacy: getOrInferPrivacy(namespacedName, docs),
      jsdoc: docs,
      mixins: jsdoc.getMixinApplications(
          this._document, node, docs, this.warnings, nodePath)
    });
    this._currentMixin = mixin;
    this._currentMixinNode = node;
    this.mixins.push(this._currentMixin);
  }

  private clearOnLeave(node: babel.Node) {
    if (this._currentMixinNode === node) {
      this._currentMixin = null;
      this._currentMixinNode = null;
      this._currentMixinFunction = null;
    }
  }

  enterFunctionExpression(node: babel.FunctionExpression, _parent: babel.Node) {
    if (this._currentMixin != null && this._currentMixinFunction == null) {
      this._currentMixinFunction = node;
    }
  }

  enterArrowFunctionExpression(
      node: babel.ArrowFunctionExpression, _parent: babel.Node) {
    if (this._currentMixin != null && this._currentMixinFunction == null) {
      this._currentMixinFunction = node;
    }
  }

  enterClassExpression(node: babel.ClassExpression, parent: babel.Node) {
    if (!babel.isReturnStatement(parent) &&
        !babel.isArrowFunctionExpression(parent)) {
      return;
    }
    this._handleClass(node);
  }

  enterClassDeclaration(node: babel.ClassDeclaration, _parent: babel.Node) {
    const comment = esutil.getAttachedComment(node) || '';
    const docs = jsdoc.parseJsdoc(comment);
    const isMixinClass = hasMixinClassDocTag(docs);
    if (isMixinClass) {
      this._handleClass(node);
    }
  }

  private _handleClass(node: babel.ClassDeclaration|babel.ClassExpression) {
    const mixin = this._currentMixin;
    if (mixin == null) {
      return;
    }

    mixin.classAstNode = node;
    const classProperties = extractPropertiesFromClass(node, this._document);
    for (const prop of classProperties.values()) {
      mixin.addProperty(prop);
    }
    getPolymerProperties(node, this._document)
        .forEach((p) => mixin.addProperty(p));
    getMethods(node, this._document).forEach((m) => mixin.addMethod(m));
    getStaticMethods(node, this._document)
        .forEach((m) => mixin.staticMethods.set(m.name, m));

    mixin.events = esutil.getEventComments(node);
    // mixin.sourceRange = this._document.sourceRangeForNode(node);

    return mixin;
  }
}

export function hasMixinFunctionDocTag(docs: jsdoc.Annotation) {
  // TODO(justinfagnani): remove polymerMixin support
  return (jsdoc.hasTag(docs, 'polymer') &&
          jsdoc.hasTag(docs, 'mixinFunction')) ||
      jsdoc.hasTag(docs, 'polymerMixin');
}

export function hasMixinClassDocTag(docs: jsdoc.Annotation) {
  // TODO(justinfagnani): remove polymerMixinClass support
  return (jsdoc.hasTag(docs, 'polymer') && jsdoc.hasTag(docs, 'mixinClass')) ||
      jsdoc.hasTag(docs, 'polymerMixinClass');
}
