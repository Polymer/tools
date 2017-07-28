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
import {NamespaceMemberToExport} from '../js-module';
import jsc = require('jscodeshift');
import {Document} from 'polymer-analyzer';
import {NodePath} from 'ast-types';
import * as astTypes from 'ast-types';
import {sourceLocationsEqual, getNodePath, getMemberPath} from '../util';

export class RewriteNamespaceExportsPass {
  private readonly localNamespaceNames: ReadonlySet<string>;
  private readonly exportMigrationRecords: NamespaceMemberToExport[] = [];
  private readonly namespaceNames = new Set<string>();
  constructor(
      private program: estree.Program, private document: Document,
      private readonly _mutableExports:
          {readonly [namespaceName: string]: ReadonlyArray<string>},
      private readonly namespaces: ReadonlySet<string>) {
    this.localNamespaceNames =
        new Set(getLocalNamesOfLocallyDeclaredNamespaces(this.document));
  }

  run() {
    // Modifies this.program, adds namespaces to this.namespaces, and
    // adds export migration records to this.exportMigrationRecords.
    visitToplevelStatements(
        this.program, (path) => this.rewriteToplevelStatement(path, path.node));

    return {
      localNamespaceNames: this.localNamespaceNames,
      namespaceNames: this.namespaceNames,
      exportMigrationRecords: this.exportMigrationRecords,
    };
  }

  /**
   * Called for each toplevel statement in this.program.
   */
  private rewriteToplevelStatement(path: NodePath, statement: estree.Node) {
    const namespaceDeclaration =
        extractNamespaceDeclaration(statement, this.namespaces);
    if (namespaceDeclaration !== undefined) {
      const {memberPath: namespaceMemberPath, value} = namespaceDeclaration;
      this.rewriteDeclaration(path, value, namespaceMemberPath);
      return;
    }

    const localNamespaceDeclaration =
        extractNamespaceDeclaration(statement, this.localNamespaceNames);

    if (localNamespaceDeclaration === undefined) {
      return;
    }

    const {memberPath, value} = localNamespaceDeclaration;
    const nameExportedAs = memberPath[memberPath.length - 1];
    const fullyQualifiedName = memberPath.join('.');
    this.namespaceNames.add(fullyQualifiedName);

    path.replace(jsc.exportNamedDeclaration(jsc.variableDeclaration(
        'const',
        [jsc.variableDeclarator(jsc.identifier(nameExportedAs), value)])));
    this.exportMigrationRecords.push(
        {oldNamespacedName: fullyQualifiedName, es6ExportName: nameExportedAs});
  }

  /**
   * Given a declaration of a namespace – or a property assignment into one –
   * converts it into the equivalent export statements and notes the mapping
   * from namespaced name to export name in this.exportMigrationRecords.
   *
   * @param nodePath
   * @param exportedExpression
   * @param fullyQualifiedNamePath
   */
  private rewriteDeclaration(
      nodePath: NodePath, exportedExpression: estree.Expression,
      fullyQualifiedNamePath: string[]) {
    const fullyQualifiedName = fullyQualifiedNamePath.join('.');
    this.namespaceNames.add(fullyQualifiedName);
    if (this.isNamespace(nodePath.node) &&
        exportedExpression.type === 'ObjectExpression') {
      // We're assigning directly to a namespace, and assigning an object
      // as well, like:
      //
      // Polymer.Path = {foo, bar}
      this.rewriteNamespaceObject(
          fullyQualifiedName, exportedExpression, nodePath);
    } else if (exportedExpression.type === 'Identifier') {
      // An 'export' of the form:
      // Polymer.Foo = Foo;
      // TODO(justinfagnani): generalize to handle namespaces and other
      // declarations
      this.rewriteAssignmentWithIdentifierRHS(
          exportedExpression,
          fullyQualifiedName,
          fullyQualifiedNamePath,
          nodePath);
    } else {
      let name = fullyQualifiedNamePath[fullyQualifiedNamePath.length - 1];
      // Special Polymer workaround: Register & rewrite the
      // `Polymer._polymerFn` export as if it were the `Polymer()`
      // namespace function.
      let correctedNamespaceName = fullyQualifiedName;
      if (fullyQualifiedName === 'Polymer._polymerFn') {
        correctedNamespaceName = 'Polymer';
        name = 'Polymer';
      }
      nodePath.replace(jsc.exportNamedDeclaration(jsc.variableDeclaration(
          'const',
          [jsc.variableDeclarator(jsc.identifier(name), exportedExpression)])));
      this.exportMigrationRecords.push(
          {oldNamespacedName: correctedNamespaceName, es6ExportName: name});
    }
  }

  /**
   * Given an object literal, like `{foo: x, bar: y}`, converts it into a
   * sequence of export expressions, like:
   *
   *     export const foo = x;
   *     export const bar = y;
   *
   * Also updates this.exportMigrationRecords.
   */
  private rewriteNamespaceObject(
      fullyQualifiedName: string, body: estree.ObjectExpression,
      nodePath: NodePath) {
    const mutableExports = this._mutableExports[fullyQualifiedName];
    const namespaceExports = getNamespaceExports(body, mutableExports);

    for (const {node} of namespaceExports) {
      nodePath.insertBefore(node);
    }
    nodePath.prune();

    for (const e of namespaceExports) {
      this.exportMigrationRecords.push({
        oldNamespacedName: `${fullyQualifiedName}.${e.name}`,
        es6ExportName: e.name
      });
    }
    this.exportMigrationRecords.push(
        {oldNamespacedName: fullyQualifiedName, es6ExportName: '*'});
  }

  /**
   * Rewrite an assignment that looks like:
   *
   *     Polymer.Foo = bar;
   *
   * If bar is a namespace, then references to Polymer.Foo need to be
   * rewritten to bar's exports.
   *
   * Otherwise we should just do something like:
   *
   *     export const Foo = bar;
   */
  private rewriteAssignmentWithIdentifierRHS(
      identifier: estree.Identifier, fullyQualifiedName: string,
      fullyQualifiedNamePath: string[], assignment: NodePath) {
    const [namespaceFeature] =
        this.document.getFeatures({id: fullyQualifiedName, kind: 'namespace'});

    if (namespaceFeature !== undefined) {
      // // Polymer.X = X; where X is previously defined as a namespace

      // Find the namespace node and containing statement
      const namespaceDeclarationStatement =
          getNodePath(this.program, namespaceFeature.astNode);
      if (namespaceDeclarationStatement == null) {
        throw new Error(`can't find associated node for namespace`);
      }
      const namespaceDeclarationValue =
          getAssignmentValue(namespaceDeclarationStatement.node);
      if (!namespaceDeclarationValue ||
          namespaceDeclarationValue.type !== 'ObjectExpression') {
        return;
      }
      this.rewriteNamespaceObject(
          fullyQualifiedName,
          namespaceDeclarationValue,
          namespaceDeclarationStatement);

      // Remove the namespace assignment
      assignment.prune();
    } else {
      // Not a namespace, fallback to a named export
      // We could probably do better for referenced declarations, ie
      // move the export to the declaration
      const exportedName =
          fullyQualifiedNamePath[fullyQualifiedNamePath.length - 1];
      assignment.replace(jsc.exportNamedDeclaration(
          null,  // declaration
          [jsc.exportSpecifier(identifier, jsc.identifier(exportedName))]));
      this.exportMigrationRecords.push(
          {es6ExportName: exportedName, oldNamespacedName: fullyQualifiedName});
    }
  }

  private isNamespace(node: estree.Node) {
    const namespaces = this.document.getFeatures({kind: 'namespace'});
    for (const namespace of namespaces) {
      if (sourceLocationsEqual(namespace.astNode, node)) {
        return true;
      }
    }
    return false;
  }
}

/**
 * Yields the name of every namespace *variable* declared locally.
 *
 * Does not deal with namespaces like this, though maybe it should:
 *
 *    // @namespace
 *    Polymer.Path = whatever;
 */
function* getLocalNamesOfLocallyDeclaredNamespaces(document: Document) {
  for (const namespace of document.getFeatures({kind: 'namespace'})) {
    if (namespace.astNode && namespace.astNode.type) {
      const astNode = namespace.astNode as estree.Node;
      if (astNode.type === 'VariableDeclaration') {
        const declaration = astNode.declarations[0];
        if (declaration.id.type === 'Identifier') {
          yield declaration.id.name;
        }
      }
    }
  }
}

/**
 * Calls `cb` for each statement at the top level of `program`.
 *
 * Like `program.body.forEach(cb)` except it passes in NodePaths rather than
 * Nodes, so that `cb` can mutate the AST with the NodePath api.
 */
function visitToplevelStatements(
    program: estree.Program, cb: (path: NodePath) => void) {
  astTypes.visit(program, {
    visitNode(path: NodePath<estree.Node>) {
      if (!path.parent) {
        // toplevel program
        this.traverse(path);
        return;
      }
      if (path.parent.node.type !== 'Program') {
        // not a toplevel statement, skip it
        return false;
      }
      this.traverse(path);

      // ok, path.node must be a toplevel statement of the program.
      cb(path);
      return;
    }
  });
}

/**
 * Return the right hand side of an assignment/variable declaration.
 */
function getAssignmentValue(node: estree.Node): estree.Expression|null|
    undefined {
  if (node.type === 'VariableDeclaration' && node.declarations.length > 0) {
    // case: const n = {...}
    return node.declarations[0].init;
  } else if (
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'AssignmentExpression') {
    // case: n = {...}
    return node.expression.right;
  }
  return;
}

/**
 * Returns export declarations for each of a namespace object's members.
 *
 * Pure, does no mutation.
 */
function getNamespaceExports(
    namespace: estree.ObjectExpression,
    mutableExports?: ReadonlyArray<string>) {
  const exportRecords: {name: string, node: estree.Node}[] = [];

  for (const {key, value} of namespace.properties) {
    if (key.type !== 'Identifier') {
      console.warn(`unsupported namespace property type ${key.type}`);
      continue;
    }
    const name = key.name;
    if (value.type === 'ObjectExpression' || value.type === 'ArrayExpression' ||
        value.type === 'Literal') {
      const isMutable = !!(mutableExports && mutableExports.includes(name));
      exportRecords.push({
        name,
        node: jsc.exportNamedDeclaration(jsc.variableDeclaration(
            isMutable ? 'let' : 'const', [jsc.variableDeclarator(key, value)]))
      });
    } else if (value.type === 'FunctionExpression') {
      const func = value;
      exportRecords.push({
        name,
        node: jsc.exportNamedDeclaration(jsc.functionDeclaration(
            key,  // id
            func.params,
            func.body,
            func.generator))
      });
    } else if (value.type === 'ArrowFunctionExpression') {
      exportRecords.push({
        name,
        node: jsc.exportNamedDeclaration(jsc.variableDeclaration(
            'const', [jsc.variableDeclarator(key, value)]))
      });
    } else if (value.type === 'Identifier') {
      exportRecords.push({
        name,
        node: jsc.exportNamedDeclaration(
            null,
            [jsc.exportSpecifier(jsc.identifier(name), jsc.identifier(name))]),
      });
    } else {
      console.warn('Namespace property not handled:', name, value);
    }
  }

  return exportRecords;
}

/**
 * If a statement assigns to a namespace or property/deeply nested property of a
 * namespace, return info about the declaration.
 */
function extractNamespaceDeclaration(
    statement: estree.Node, namespaces: ReadonlySet<string>):
    {memberPath: string[], value: estree.Expression}|undefined {
  if (!(statement.type === 'ExpressionStatement' &&
        statement.expression.type === 'AssignmentExpression')) {
    return undefined;
  }
  const assignment = statement.expression;
  if (!(assignment.left.type === 'MemberExpression')) {
    return undefined;
  }

  const memberPath = getMemberPath(assignment.left);

  if (memberPath !== undefined && namespaces.has(memberPath[0])) {
    return {
      memberPath,
      value: assignment.right,
    };
  }
  return undefined;
}
