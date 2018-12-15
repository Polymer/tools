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

import * as astTypes from 'ast-types';
import {NodePath} from 'ast-types';
import * as estree from 'estree';
import * as jsc from 'jscodeshift';
import {Document} from 'polymer-analyzer';

import {getMemberName, getMemberPath, getNodePathInProgram, getTopLevelStatements, isSourceLocationEqual} from '../document-util';
import {NamespaceMemberToExport} from '../js-module';
import {babelNodeToEstreeNode} from '../util';

export function rewriteNamespacesAsExports(
    program: estree.Program,
    document: Document,
    namespaces: ReadonlySet<string>) {
  return new RewriteNamespaceExportsPass(program, document, namespaces).run();
}

class RewriteNamespaceExportsPass {
  /**
   * The local, potentially private names of some namespaces.
   */
  private readonly localNamespaceNames: ReadonlySet<string>;
  private readonly namespaceNames = new Set<string>();
  private readonly mutableNames: ReadonlySet<string>;
  /**
   * Tracks the mapping between the old namespaced way of referencing a value
   * and the name given when it's exported from this module.
   */
  private readonly exportMigrationRecords: NamespaceMemberToExport[] = [];
  constructor(
      private readonly program: estree.Program,
      private readonly document: Document,
      private readonly namespaces: ReadonlySet<string>) {
    this.mutableNames = getMutableNames(program);
    this.localNamespaceNames =
        new Set(getLocalNamesOfLocallyDeclaredNamespaces(this.document));
  }

  /**
   * The core of the rewrite pass.
   *
   * The goal is to find everywhere that we're "exporting" something by
   * declaring or adding to a namespace object like `Polymer` and rewrite it
   * into one or more ES6 exports.
   *
   * Mutates this.program, this.namespaceNames, and this.exportMigrationRecords.
   */
  run() {
    for (const path of getTopLevelStatements(this.program)) {
      const statement = path.node;
      const namespaceDeclaration =
          getNamespaceDeclaration(statement, this.namespaces);
      const localNamespaceDeclaration =
          getNamespaceDeclaration(statement, this.localNamespaceNames);

      if (namespaceDeclaration !== undefined) {
        const {memberPath: namespaceMemberPath, value} = namespaceDeclaration;
        this.rewriteDeclaration(path, value, namespaceMemberPath);
        continue;
      } else if (localNamespaceDeclaration !== undefined) {
        const {memberPath, value} = localNamespaceDeclaration;
        this.rewriteLocalDeclaration(path, value, memberPath);
      }  // otherwise, not a namespace declaration at all.
    }

    return {
      localNamespaceNames: this.localNamespaceNames,
      namespaceNames: this.namespaceNames,
      exportMigrationRecords: this.exportMigrationRecords,
    };
  }

  /**
   * Given a declaration of a namespace – or a property assignment into one –
   * converts it into the equivalent export statements and notes the mapping
   * from namespaced name to export name in this.exportMigrationRecords.
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
      } else if (fullyQualifiedName === 'Polymer.Element') {
        name = 'PolymerElement';
      }
      const variableKind =
          this.mutableNames.has(correctedNamespaceName) ? 'let' : 'const';
      const newExportNode = jsc.exportNamedDeclaration(jsc.variableDeclaration(
          variableKind,
          [jsc.variableDeclarator(jsc.identifier(name), exportedExpression)]));
      replacePreservingComments(nodePath, newExportNode);
      this.exportMigrationRecords.push(
          {oldNamespacedName: correctedNamespaceName, es6ExportName: name});
    }
  }

  /**
   * Given an assignment into a locally defined namespace, convert it
   * into an ES6 export.
   */
  private rewriteLocalDeclaration(
      path: NodePath, value: estree.Expression, memberPath: string[]) {
    const nameExportedAs = memberPath[memberPath.length - 1];
    const fullyQualifiedName = memberPath.join('.');
    this.namespaceNames.add(fullyQualifiedName);

    // Note: in other place in this file where we decide between let and const
    // exports, we check if the "this." name is mutable as well, but in this
    // case it's very unlikely that a name assigned imperatively, like NS.foo =
    // is otherwise accessed via "this."
    replacePreservingComments(
        path,
        jsc.exportNamedDeclaration(jsc.variableDeclaration(
            this.mutableNames.has(fullyQualifiedName) ? 'let' : 'const',
            [jsc.variableDeclarator(jsc.identifier(nameExportedAs), value)])));
    this.exportMigrationRecords.push(
        {oldNamespacedName: fullyQualifiedName, es6ExportName: nameExportedAs});
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
    const namespaceExports =
        getNamespaceExports(body, this.mutableNames, fullyQualifiedName);

    // Replace nodePath with some number of namespace exports. Easiest way
    // is to insert the exports after nodePath, then remove nodePath.
    const nodePathComments = getComments(nodePath);
    if (nodePathComments.length > 0) {
      const message =
          `TODO(modulizer): A namespace named ${fullyQualifiedName} was\n` +
          `declared here. The surrounding comments should be reviewed,\n` +
          `and this string can then be deleted`;
      const tombstone = jsc.expressionStatement(jsc.templateLiteral(
          [jsc.templateElement({raw: message, cooked: message}, true)], []));
      (tombstone as NodeWithComments).comments = nodePathComments;
      nodePath.insertBefore(tombstone);
    }
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
          getNodePathInProgram(this.program, namespaceFeature.astNode);
      if (namespaceDeclarationStatement == null) {
        throw new Error(`can't find associated node for namespace`);
      }
      const namespaceDeclarationValue =
          getAssignmentValue(namespaceDeclarationStatement.node);
      if (namespaceDeclarationValue === undefined ||
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
      let exportedName =
          fullyQualifiedNamePath[fullyQualifiedNamePath.length - 1];

      // Special Polymer workaround: Rename `Polymer.Element` to have the
      // es6ExportName `PolymerElement`.
      if (fullyQualifiedName === 'Polymer.Element') {
        exportedName = 'PolymerElement';
      }

      replacePreservingComments(
          assignment,
          jsc.exportNamedDeclaration(
              null,  // declaration
              [jsc.exportSpecifier(identifier, jsc.identifier(exportedName))]));
      this.exportMigrationRecords.push(
          {es6ExportName: exportedName, oldNamespacedName: fullyQualifiedName});
    }
  }

  private isNamespace(node: estree.Node) {
    const namespaces = this.document.getFeatures({kind: 'namespace'});
    for (const namespace of namespaces) {
      if (isSourceLocationEqual(
              babelNodeToEstreeNode(namespace.astNode.node), node)) {
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
function getLocalNamesOfLocallyDeclaredNamespaces(document: Document) {
  const names = [];
  for (const namespace of document.getFeatures({kind: 'namespace'})) {
    const astNode = babelNodeToEstreeNode(namespace.astNode.node);
    if (astNode.type === 'VariableDeclaration') {
      const declaration = astNode.declarations[0];
      if (declaration.id.type === 'Identifier') {
        names.push(declaration.id.name);
      }
    }
  }
  return names;
}


/**
 * Return the right hand side of an assignment/variable declaration.
 */
function getAssignmentValue(node: estree.Node): estree.Expression|undefined {
  if (node.type === 'VariableDeclaration' && node.declarations.length > 0) {
    // case: `const n = {...}`
    return node.declarations[0].init || undefined;
  } else if (
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'AssignmentExpression') {
    // case: `n = {...}`
    return node.expression.right;
  }
  return;
}

/**
 * Returns export declarations for each of a namespace object's members.
 */
function getNamespaceExports(
    namespace: estree.ObjectExpression,
    mutableNames: ReadonlySet<string>,
    namespaceName: string) {
  const exportRecords: {name: string, node: estree.Node}[] = [];

  for (const propNode of namespace.properties) {
    const {key, value} = propNode;
    if (key.type !== 'Identifier') {
      console.warn(`unsupported namespace property type ${key.type}`);
      continue;
    }
    const name = key.name;
    const fullName = `${namespaceName}.${name}`;
    // The expression for an internal `this.` reference to a namespace member
    const thisName = `this.${name}`;
    const isMutable = mutableNames.has(fullName) || mutableNames.has(thisName);
    if (value.type === 'ObjectExpression' || value.type === 'ArrayExpression' ||
        value.type === 'Literal') {
      const node = jsc.exportNamedDeclaration(jsc.variableDeclaration(
          isMutable ? 'let' : 'const', [jsc.variableDeclarator(key, value)]));
      (node as NodeWithComments).comments = getCommentsFromNode(propNode);
      exportRecords.push({name, node});
    } else if (value.type === 'FunctionExpression') {
      const func = value;
      const node = jsc.exportNamedDeclaration(jsc.functionDeclaration(
          key,  // id
          func.params,
          func.body,
          func.generator));
      (node as NodeWithComments).comments = getCommentsFromNode(propNode);
      exportRecords.push({name, node});
    } else if (value.type === 'ArrowFunctionExpression') {
      const isMutable =
          mutableNames.has(fullName) || mutableNames.has(thisName);
      const node = jsc.exportNamedDeclaration(jsc.variableDeclaration(
          isMutable ? 'let' : 'const', [jsc.variableDeclarator(key, value)]));
      (node as NodeWithComments).comments = getCommentsFromNode(propNode);
      exportRecords.push({name, node});
    } else if (value.type === 'Identifier') {
      const node = jsc.exportNamedDeclaration(
          null,
          [jsc.exportSpecifier(jsc.identifier(name), jsc.identifier(name))]);
      (node as NodeWithComments).comments = getCommentsFromNode(propNode);
      exportRecords.push({name, node});
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
function getNamespaceDeclaration(
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
  if (memberPath === undefined) {
    return undefined;
  }

  // If we're assigning directly to a namespace `Polymer = {}`
  const isNamespace = namespaces.has(memberPath.join('.'));
  // If we're assigning to a property directly on a namespace
  // `Polymer.foo = {}`
  const isAssignmentToNamespace =
      namespaces.has(memberPath.slice(0, -1).join('.'));
  if (isNamespace || isAssignmentToNamespace) {
    return {
      memberPath,
      value: assignment.right,
    };
  }
  return undefined;
}

/**
 * Find all nested names that are written to multiple times. i.e. they must all
 * be rewritten as `let` and can't be represented as a `const`.
 *
 * We used the heuristic that they're assigned to more than once, or they're
 * updated in a `++` or `--` operation.
 */
function getMutableNames(program: estree.Program): Set<string> {
  const mutable = new Set<string>();
  const assignedOnce = new Set<string>();
  astTypes.visit(program, {

    /** DeeplyNestedNamespace = 'something'; */
    visitAssignmentExpression(path: NodePath<estree.AssignmentExpression>) {
      const memberName = getMemberName(path.node.left);
      if (memberName !== undefined) {
        // Treating a this.* reference as mutable assumes that it's declared
        // as a namespace object property elsewhere and this is always a
        // mutation. Because we don't know the namespace were currently in,
        // there's a danger of a false positive here. This really should be
        // integrated with getNamespaceExports / getNamespaceDeclaration.
        if (assignedOnce.has(memberName) || memberName.startsWith('this.')) {
          mutable.add(memberName);
        } else {
          assignedOnce.add(memberName);
        }
      }
      this.traverse(path);
    },

    /** Unary '++' or '--' */
    visitUpdateExpression(path: NodePath<estree.UpdateExpression>) {
      const memberName = getMemberName(path.node.argument);
      if (memberName) {
        mutable.add(memberName);
      }
      this.traverse(path);
    }
  });

  return mutable;
}

const jsdocToRemove = /@(namespace|memberof)/;
function replacePreservingComments(
    nodePath: NodePath, replacement: estree.Node) {
  const comments = getComments(nodePath);
  nodePath.replace(replacement);
  (nodePath.node as NodeWithComments).comments = comments;
}

type NodeWithComments = estree.Node&{comments?: estree.Comment[]};


function getComments(nodePath: NodePath) {
  return getCommentsFromNode(nodePath.node);
}
function getCommentsFromNode(node: NodeWithComments): estree.Comment[] {
  const results = [];
  if (node.comments) {
    results.push(...node.comments);
  }
  return correctComments(results);
}

function correctComments(comments: estree.Comment[]): estree.Comment[] {
  const correctedComments = [];
  for (const existingComment of comments) {
    const comment = {...existingComment};
    // Filter out namespace and memberof comments, which no longer make sense.
    const lines = comment.value.split('\n');
    comment.value =
        lines.filter((l) => !jsdocToRemove.test(l))
            .map((line, index) => {
              if (index === 0) {
                return line;
              }
              // Make a reasonable guess to how to indent the lines
              // of a jsdoc comment, since now that we're modifying
              // the comment value, recast won't help us anymore.
              return line.replace(/^\s+\*/, ' *').replace(/^\s+$/, ' ');
            })
            .join('\n');
    // If a comment now only has whitespace and * charactes, we should filter it
    // out entirely.
    if (!/[^\s\*]/.test(comment.value)) {
      continue;
    }
    correctedComments.push(comment);
  }
  return correctedComments;
}
