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
import * as esutil from './esutil';
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

const exportKinds: ReadonlySet<string> = new Set(['export']);
export class Export implements Resolvable, Feature {
  readonly kinds = exportKinds;
  readonly identifiers = new Set<string>();
  readonly description: undefined;
  readonly jsdoc: undefined;
  readonly sourceRange: SourceRange|undefined;
  readonly astNodePath: NodePath<babel.Node>;
  readonly astNode: ExportNode;
  readonly statementAst: babel.Statement;
  readonly warnings: ReadonlyArray<Warning> = [];

  constructor(
      astNode: ExportNode, statementAst: babel.Statement,
      sourceRange: SourceRange|undefined, nodePath: NodePath<babel.Node>) {
    this.astNode = astNode;
    this.statementAst = statementAst;
    for (const name of esutil.getBindingNamesFromDeclaration(astNode)) {
      this.identifiers.add(name);
    }

    this.astNodePath = nodePath;
    this.sourceRange = sourceRange;
  }

  // It's immutable, and it doesn't care about other documents, so it's
  // both a ScannedFeature and a Feature. This is just one step in an
  // arbitrarily long chain of references.
  resolve(_document: Document): Feature|undefined {
    // TODO: Could potentially get a speed boost by doing the Reference
    //   resolution algorithm here. Especially in cases of re-export.
    //   would need to separate out ScannedExport from Export in that case.
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
        exports.push(new Export(
            node,
            esutil.getCanonicalStatement(path)!,
            document.sourceRangeForNode(node),
            path));
      },
      enterExportAllDeclaration(node, _parent, path) {
        exports.push(new Export(
            node,
            esutil.getCanonicalStatement(path)!,
            document.sourceRangeForNode(node),
            path));
      },
      enterExportDefaultDeclaration(node, _parent, path) {
        exports.push(new Export(
            node,
            esutil.getCanonicalStatement(path)!,
            document.sourceRangeForNode(node),
            path));
      }
    });
    return {features: exports, warnings};
  }
}
