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

import * as estree from 'estree';

import {getIdentifierName, getNamespacedIdentifier} from '../javascript/ast-value';
import {Visitor} from '../javascript/estree-visitor';
import * as esutil from '../javascript/esutil';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptScanner} from '../javascript/javascript-scanner';
import * as jsdoc from '../javascript/jsdoc';
import {Warning} from '../model/model';

import {getOrInferPrivacy} from './js-utils';
import {ScannedPolymerElementMixin} from './polymer-element-mixin';
import {getMethods, getProperties} from './polymer2-config';

export class Polymer2MixinScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument, visit: (visitor: Visitor) => Promise<void>):
      Promise<ScannedPolymerElementMixin[]> {
    const visitor = new MixinVisitor(document);
    await visit(visitor);
    return visitor._mixins;
  }
}

class MixinVisitor implements Visitor {
  _mixins: ScannedPolymerElementMixin[] = [];
  private _document: JavaScriptDocument;

  private _currentMixin: ScannedPolymerElementMixin|null = null;
  private _currentMixinNode: estree.Node|null = null;
  private _currentMixinFunction: estree.BaseFunction|null = null;
  // TODO(rictic): do something with these warnings.
  private _warnings: Warning[] = [];

  constructor(document: JavaScriptDocument) {
    this._document = document;
  }

  enterAssignmentExpression(
      node: estree.AssignmentExpression, parent: estree.Node) {
    if (parent.type !== 'ExpressionStatement') {
      return;
    }
    const parentComments = esutil.getAttachedComment(parent) || '';
    const parentJsDocs = jsdoc.parseJsdoc(parentComments);
    if (this._hasPolymerMixinDocTag(parentJsDocs)) {
      const name = getIdentifierName(node.left);
      const namespacedName =
          name ? getNamespacedIdentifier(name, parentJsDocs) : undefined;
      const sourceRange = this._document.sourceRangeForNode(node)!;

      const summaryTag = jsdoc.getTag(parentJsDocs, 'summary');

      if (namespacedName) {
        this._currentMixin = new ScannedPolymerElementMixin({
          name: namespacedName,
          sourceRange,
          description: parentJsDocs.description,
          summary: (summaryTag && summaryTag.description) || '',
          privacy: getOrInferPrivacy(namespacedName, parentJsDocs, false),
          jsdoc: parentJsDocs,
          mixins: jsdoc.getMixins(
              this._document, node, parentJsDocs, this._warnings),
        });
        this._currentMixinNode = node;
        this._mixins.push(this._currentMixin);
      } else {
        // TODO(rictic): warn for a mixin whose name we can't determine.
      }
    }
  }

  enterFunctionDeclaration(
      node: estree.FunctionDeclaration, _parent: estree.Node) {
    const nodeComments = esutil.getAttachedComment(node) || '';
    const nodeJsDocs = jsdoc.parseJsdoc(nodeComments);
    if (this._hasPolymerMixinDocTag(nodeJsDocs)) {
      const name = node.id.name;
      const namespacedName =
          name ? getNamespacedIdentifier(name, nodeJsDocs) : undefined;
      const sourceRange = this._document.sourceRangeForNode(node)!;
      this._currentMixinFunction = node;

      const summaryTag = jsdoc.getTag(nodeJsDocs, 'summary');

      if (namespacedName) {
        this._currentMixin = new ScannedPolymerElementMixin({
          name: namespacedName,
          sourceRange,
          description: nodeJsDocs.description,
          summary: (summaryTag && summaryTag.description) || '',
          privacy: getOrInferPrivacy(namespacedName, nodeJsDocs, false),
          jsdoc: nodeJsDocs,
          mixins:
              jsdoc.getMixins(this._document, node, nodeJsDocs, this._warnings)
        });
        this._currentMixinNode = node;
        this._mixins.push(this._currentMixin);
      } else {
        // Warn about a mixin whose name we can't infer.
      }
    }
  }

  leaveFunctionDeclaration(
      node: estree.FunctionDeclaration, _parent: estree.Node) {
    if (this._currentMixinNode === node) {
      this._currentMixin = null;
      this._currentMixinNode = null;
      this._currentMixinFunction = null;
    }
  }

  enterVariableDeclaration(
      node: estree.VariableDeclaration, _parent: estree.Node) {
    const comment = esutil.getAttachedComment(node) || '';
    const docs = jsdoc.parseJsdoc(comment);
    const isMixin = this._hasPolymerMixinDocTag(docs);
    const sourceRange = this._document.sourceRangeForNode(node)!;
    const summaryTag = jsdoc.getTag(docs, 'summary');
    if (isMixin) {
      let mixin: ScannedPolymerElementMixin|undefined = undefined;
      if (node.declarations.length === 1) {
        const declaration = node.declarations[0];
        const name = getIdentifierName(declaration.id);
        if (name) {
          const namespacedName = getNamespacedIdentifier(name, docs);
          mixin = new ScannedPolymerElementMixin({
            name: namespacedName,
            sourceRange,
            description: docs.description,
            summary: (summaryTag && summaryTag.description) || '',
            privacy: getOrInferPrivacy(namespacedName, docs, false),
            jsdoc: docs,
            mixins: jsdoc.getMixins(
                this._document, declaration, docs, this._warnings)
          });
        }
      }
      if (mixin) {
        this._currentMixin = mixin;
        this._currentMixinNode = node;
        this._mixins.push(this._currentMixin);
      } else {
        // TODO(rictic); warn about being unable to determine mixin name.
      }
    }
  }

  leaveVariableDeclaration(
      node: estree.VariableDeclaration, _parent: estree.Node) {
    if (this._currentMixinNode === node) {
      this._currentMixin = null;
      this._currentMixinNode = null;
      this._currentMixinFunction = null;
    }
  }

  enterFunctionExpression(
      node: estree.FunctionExpression, _parent: estree.Node) {
    if (this._currentMixin != null && this._currentMixinFunction == null) {
      this._currentMixinFunction = node;
    }
  }

  enterArrowFunctionExpression(
      node: estree.ArrowFunctionExpression, _parent: estree.Node) {
    if (this._currentMixin != null && this._currentMixinFunction == null) {
      this._currentMixinFunction = node;
    }
  }

  enterClassExpression(node: estree.ClassExpression, parent: estree.Node) {
    if (parent.type !== 'ReturnStatement' &&
        parent.type !== 'ArrowFunctionExpression') {
      return;
    }
    this._handleClass(node);
  }

  enterClassDeclaration(node: estree.ClassDeclaration, _parent: estree.Node) {
    const comment = esutil.getAttachedComment(node) || '';
    const docs = jsdoc.parseJsdoc(comment);
    const isMixinClass = this._hasPolymerMixinClassDocTag(docs);
    if (isMixinClass) {
      this._handleClass(node);
    }
  }

  private _handleClass(node: estree.ClassDeclaration|estree.ClassExpression) {
    const mixin = this._currentMixin;
    if (mixin == null) {
      return;
    }

    getProperties(node, this._document).forEach((p) => mixin.addProperty(p));
    getMethods(node, this._document).forEach((m) => mixin.addMethod(m));

    mixin.events = esutil.getEventComments(node);
    // mixin.sourceRange = this._document.sourceRangeForNode(node);
    return mixin;
  }

  private _hasPolymerMixinDocTag(docs: jsdoc.Annotation) {
    const elementTags = docs.tags &&
        docs.tags.filter((t: jsdoc.Tag) => t.tag === 'polymerMixin');
    return elementTags && elementTags.length >= 1;
  }

  private _hasPolymerMixinClassDocTag(docs: jsdoc.Annotation) {
    const elementTags = docs.tags &&
        docs.tags.filter((t: jsdoc.Tag) => t.tag === 'polymerMixinClass');
    return elementTags && elementTags.length >= 1;
  }
}
