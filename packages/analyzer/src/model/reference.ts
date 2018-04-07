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

import {NodePath} from '@babel/traverse';
import * as babel from '@babel/types';
import * as util from 'util';

import * as esutil from '../javascript/esutil';
import {Annotation} from '../javascript/jsdoc';

import {Result} from './analysis';
import {Document} from './document';
import {Feature, ScannedFeature} from './feature';
import {FeatureKindMap} from './queryable';
import {Resolvable} from './resolvable';
import {SourceRange} from './source-range';
import {Severity, Warning} from './warning';


/**
 * A reference to another feature by identifier.
 */
export class ScannedReference<K extends keyof FeatureKindMap> extends
    ScannedFeature implements Resolvable {
  readonly identifier: string;
  readonly kind: K;
  readonly sourceRange: SourceRange|undefined;
  readonly astPath: NodePath;
  readonly astNode: babel.Node|undefined;

  constructor(
      kind: K, identifier: string, sourceRange: SourceRange|undefined,
      astNode: babel.Node|undefined, astPath: NodePath, description?: string,
      jsdoc?: Annotation, warnings?: Warning[]) {
    super(sourceRange, astNode, description, jsdoc, warnings);
    this.kind = kind;
    this.astNode = astNode;
    this.astPath = astPath;
    this.sourceRange = sourceRange;
    this.identifier = identifier;
  }

  resolve(document: Document): Reference<FeatureKindMap[K]> {
    return this.resolveWithKind(document, this.kind);
  }

  // Leaving this as a public method, in case we want to use a more
  // specific kind (e.g. resolve a PolymerElement rather than just a Class).
  resolveWithKind<DK extends keyof FeatureKindMap>(
      document: Document, kind: DK): Reference<FeatureKindMap[DK]> {
    let feature: undefined|FeatureKindMap[DK];
    const warnings = [...this.warnings];

    const scopedResult =
        resolveScopedAt(this.astPath, this.identifier, document, kind);
    if (scopedResult.successful) {
      feature = scopedResult.value;
    } else {
      if (scopedResult.error !== undefined) {
        warnings.push(scopedResult.error);
      }
    }
    // TODO(https://github.com/Polymer/polymer-analyzer/issues/917):
    //     Don't look things up in the global map if the scoped binding
    //     resolves.
    if (feature === undefined) {
      // We didn't find it by doing principled scope-based analysis. Let's try
      // looking it up in our big global map!
      const features = document.getFeatures(
          {imported: true, externalPackages: true, kind, id: this.identifier});
      if (this.sourceRange) {
        if (features.size === 0) {
          let message = `Could not resolve reference to ${this.kind}`;
          if (kind === 'behavior') {
            message += `. Is it annotated with @polymerBehavior?`;
          }
          warnings.push(new Warning({
            code: 'could-not-resolve-reference',
            sourceRange: this.sourceRange,
            message,
            parsedDocument: document.parsedDocument,
            severity: Severity.WARNING
          }));
        } else if (features.size > 1) {
          warnings.push(new Warning({
            code: 'multiple-global-declarations',
            sourceRange: this.sourceRange,
            message: `Multiple global declarations of ${
                this.kind} with identifier ${this.identifier}`,
            parsedDocument: document.parsedDocument,
            severity: Severity.WARNING
          }));
        }
      }
      [feature] = features;
    }
    return new Reference<FeatureKindMap[K]>(this, feature, warnings);
  }
}

function resolveScopedAt<K extends keyof FeatureKindMap>(
    path: NodePath, identifier: string, document: Document, kind: K):
    Result<FeatureKindMap[K], Warning|undefined> {
  // TODO(https://github.com/Polymer/polymer-analyzer/issues/919): we need to
  //     emit warnings from this function.

  // Handle all kinds of imports except namespace imports (see below for them).
  if (isSomeKindOfImport(path)) {
    const exportedIdentifier = getExportedIdentifier(path.node, identifier);
    return resolveThroughImport(path, exportedIdentifier, document, kind);
  }
  const statement = esutil.getCanonicalStatement(path);
  if (statement === undefined) {
    return {successful: false, error: undefined};
  }
  const features = document.getFeatures({kind, id: identifier, statement});
  if (features.size > 1) {
    // TODO(rictic): narrow down by identifier? warn?
    return {successful: false, error: undefined};
  }
  const [feature] = features;
  if (feature !== undefined) {
    return {successful: true, value: feature};
  }
  // Handle namespace imports. e.g.
  //     import * as foo from 'foo-library'; class X extends foo.Bar {}
  const hasASingleDotInName = /^[^\.]+\.[^\.]+$/;
  if (hasASingleDotInName.test(identifier)) {
    const [namespace, name] = identifier.split('.');
    const namespaceBinding = path.scope.getBinding(namespace);
    if (namespaceBinding !== undefined) {
      const node = namespaceBinding.path.node;
      if (babel.isImportNamespaceSpecifier(node)) {
        return resolveThroughImport(
            namespaceBinding.path, name, document, kind);
      }
    }
  }
  const binding = path.scope.getBinding(identifier);
  if (binding === undefined || binding.path.node === path.node) {
    return {successful: false, error: undefined};
  }
  return resolveScopedAt(binding.path, identifier, document, kind);
}

function resolveThroughImport<K extends keyof FeatureKindMap>(
    path: NodePath, exportedAs: string, document: Document, kind: K):
    Result<FeatureKindMap[K], Warning|undefined> {
  const statement = esutil.getCanonicalStatement(path);
  if (statement === undefined) {
    throw new Error(`Internal error, could not get statement for node of type ${
        path.node.type}`);
  }
  const [import_] = document.getFeatures({kind: 'import', statement});
  if (import_ === undefined || import_.document === undefined) {
    // Import failed, maybe it could not be loaded.
    return {successful: false, error: undefined};
  }
  // If it was renamed like `import {foo as bar} from 'baz';` then
  // node.imported.name will be `foo`
  const [export_] =
      import_.document.getFeatures({kind: 'export', id: exportedAs});
  if (export_ === undefined) {
    // That symbol was not exported from the other file.
    return {successful: false, error: undefined};
  }
  return resolveScopedAt(
      export_.astNodePath, exportedAs, import_.document, kind);
}

// We handle ImportNamespaceSpecifiers separately, as resolving their bindings
// is slightly tricky.
type ImportIndicator = babel.ImportDefaultSpecifier|babel.ImportSpecifier|
                       babel.ExportNamedDeclaration|babel.ExportAllDeclaration;
function isSomeKindOfImport(path: NodePath): path is NodePath<ImportIndicator> {
  const node = path.node;
  return babel.isImportSpecifier(node) ||
      babel.isImportDefaultSpecifier(node) ||
      (babel.isExportNamedDeclaration(node) && node.source != null) ||
      (babel.isExportAllDeclaration(node));
}

function getExportedIdentifier(node: ImportIndicator, localIdentifier: string) {
  switch (node.type) {
    case 'ImportDefaultSpecifier':
      return 'default';
    case 'ExportNamedDeclaration':
      for (const specifier of node.specifiers) {
        if (specifier.exported.name === localIdentifier) {
          return specifier.local.name;
        }
      }
      throw new Error(`Internal error: could not find import specifier for '${
          localIdentifier}'. Please report this bug.`);
    case 'ExportAllDeclaration':
      // Can't rename through an export all, the name we're looking for in
      // this file is the same name in the next file.
      return localIdentifier;
    case 'ImportSpecifier':
      return node.imported.name;
  }
  return assertNever(node);
}

function assertNever(never: never): never {
  throw new Error(`Unexpected ast node: ${util.inspect(never)}`);
}

declare module './queryable' {
  interface FeatureKindMap {
    'reference': Reference<Feature>;
  }
}

const referenceSet: ReadonlySet<'reference'> =
    new Set<'reference'>(['reference']);
const emptySet: ReadonlySet<string> = new Set();

/**
 * A reference to another feature by identifier.
 */
export class Reference<F extends Feature> implements Feature {
  readonly kinds = referenceSet;
  readonly identifiers = emptySet;
  readonly identifier: string;
  readonly sourceRange: SourceRange|undefined;
  readonly astNode: any;
  readonly feature: F|undefined;
  readonly warnings: ReadonlyArray<Warning>;

  constructor(
      scannedReference: ScannedReference<any>, feature: F|undefined,
      warnings: ReadonlyArray<Warning>) {
    this.identifier = scannedReference.identifier;
    this.sourceRange = scannedReference.sourceRange;
    this.warnings = warnings;
    this.feature = feature;
  }
}
