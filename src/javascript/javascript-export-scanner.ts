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

import {NodePath} from 'babel-traverse';
import * as babel from 'babel-types';

import {Document, Feature, SourceRange, Warning} from '../model/model';
import {Resolvable} from '../model/resolvable';

import {Visitor} from './estree-visitor';
import {JavaScriptDocument} from './javascript-document';
import {JavaScriptScanner} from './javascript-scanner';

export type ExportNode = babel.ExportNamedDeclaration|
                         babel.ExportAllDeclaration|
                         babel.ExportDefaultDeclaration;


declare module '../model/queryable' {
  interface FeatureKindMap {
    'export': Export;
  }
}

const scannedExportKinds: ReadonlySet<string> = new Set(['export']);
export class Export implements Resolvable, Feature {
  readonly kinds = scannedExportKinds;
  readonly identifiers = new Set();
  readonly description: undefined;
  readonly jsdoc: undefined;
  readonly sourceRange: SourceRange|undefined;
  readonly astNodePath: NodePath<babel.Node>;
  readonly astNode: ExportNode;
  readonly warnings: ReadonlyArray<Warning> = [];

  constructor(
      astNode: ExportNode, sourceRange: SourceRange|undefined,
      nodePath: NodePath<babel.Node>) {
    this.astNode = astNode;
    if (astNode.type === 'ExportDefaultDeclaration') {
      this.identifiers.add('default');
    } else if (astNode.type === 'ExportNamedDeclaration') {
      for (const specifier of astNode.specifiers) {
        if (specifier.exported.type === 'Identifier') {
          this.identifiers.add(specifier.exported.name);
        }
      }
    }
    this.astNodePath = nodePath;
    this.sourceRange = sourceRange;
  }

  // It's immutable, and it doesn't care about other documents, so it's
  // both a ScannedFeature and a Feature.
  resolve(_document: Document): Feature|undefined {
    return this;
  }
}

export class JavaScriptExportScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>) {
    const exports: Export[] = [];
    const warnings: Warning[] = [];

    await visit({
      enterExportNamedDeclaration(node, _parent, path) {
        exports.push(new Export(node, document.sourceRangeForNode(node), path));
      },
      enterExportAllDeclaration(node, _parent, path) {
        exports.push(new Export(node, document.sourceRangeForNode(node), path));
      },
      enterExportDefaultDeclaration(node, _parent, path) {
        exports.push(new Export(node, document.sourceRangeForNode(node), path));
      }
    });
    return {features: exports, warnings};
  }
}
