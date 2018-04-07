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

import {NodePath} from '@babel/traverse';
import * as babel from '@babel/types';

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
      sourceRange: SourceRange|undefined, nodePath: NodePath<babel.Node>,
      exportingAllFrom?: Iterable<Export>) {
    this.astNode = astNode;
    this.statementAst = statementAst;
    let exportedIdentifiers;
    if (exportingAllFrom !== undefined) {
      exportedIdentifiers = flatMap(
          exportingAllFrom,
          (export_) => [...export_.identifiers].filter((i) => i !== 'default'));
    } else {
      exportedIdentifiers = esutil.getBindingNamesFromDeclaration(astNode);
    }
    for (const name of exportedIdentifiers) {
      this.identifiers.add(name);
    }

    this.astNodePath = nodePath;
    this.sourceRange = sourceRange;
  }

  // TODO: Could potentially get a speed boost by doing the Reference
  //   resolution algorithm here, rather than re-doing it every single place
  //   this export is referenced.
  resolve(document: Document): Feature|undefined {
    if (babel.isExportAllDeclaration(this.astNode)) {
      const [import_] =
          document.getFeatures({kind: 'import', statement: this.statementAst});
      if (import_ === undefined || import_.document === undefined) {
        // Import did not resolve.
        return undefined;
      }
      return new Export(
          this.astNode,
          this.statementAst,
          this.sourceRange,
          this.astNodePath,
          import_.document.getFeatures({kind: 'export'}));
    }
    // It's immutable, and it doesn't care about other documents, so it's
    // both a ScannedFeature and a Feature. This is just one step in an
    // arbitrarily long chain of references.

    return this;
  }
}

function*
    flatMap<In, Out>(inputs: Iterable<In>, map: (input: In) => Iterable<Out>):
        Iterable<Out> {
  for (const input of inputs) {
    yield* map(input);
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
