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
import * as dom5 from 'dom5';
import * as estree from 'estree';
import {Iterable as IterableX} from 'ix';
import * as jsc from 'jscodeshift';
import * as fs from 'mz/fs';
import * as parse5 from 'parse5';
import * as path from 'path';
import {Analysis} from 'polymer-analyzer';

import util = require('util');
import _mkdirp = require('mkdirp');
import _rimraf = require('rimraf');

import {ConvertedDocumentFilePath} from './urls/types';

/**
 * Helper promisified "mkdirp" library function.
 */
export const mkdirp = util.promisify(_mkdirp);

/**
 * Helper promisified "rimraf" library function.
 */
export const rimraf = util.promisify(_rimraf);

export function serializeNode(node: parse5.ASTNode): string {
  const container = parse5.treeAdapters.default.createDocumentFragment();
  dom5.append(container, node);
  return parse5.serialize(container);
}

/**
 * Get the import name for an imported module object. Useful when generating an
 * import statement, or a reference to an imported module object.
 */
export function getModuleId(url: string) {
  const baseName = path.basename(url);
  const lastDotIndex = baseName.lastIndexOf('.');
  const mainName = baseName.substring(0, lastDotIndex);
  return dashToCamelCase(mainName);
}

/**
 * Finds an unused identifier name given a requested name and set of used names.
 */
export function findAvailableIdentifier(requested: string, used: Set<string>) {
  let suffix = 0;
  let alias = requested;
  while (used.has(alias)) {
    alias = requested + '$' + (suffix++);
  }
  return alias;
}

function dashToCamelCase(s: string) {
  return s.replace(/-[a-z]/g, (m) => m[1].toUpperCase());
}

export function sourceLocationsEqual(a: estree.Node, b: estree.Node): boolean {
  if (a === b) {
    return true;
  }
  const aLoc = a.loc;
  const bLoc = b.loc;
  if (aLoc === bLoc) {
    return true;
  }
  if (aLoc == null || bLoc == null) {
    return false;
  }
  return aLoc.start.column === bLoc.start.column &&
      aLoc.start.line === bLoc.start.line &&
      aLoc.end.column === bLoc.end.column && aLoc.end.line === bLoc.end.line;
}

export function nodeToTemplateLiteral(
    node: parse5.ASTNode, addNewlines = true): estree.TemplateLiteral {
  const lines = parse5.serialize(node).split('\n');

  // Remove empty / whitespace-only leading lines.
  while (/^\s*$/.test(lines[0])) {
    lines.shift();
  }
  // Remove empty / whitespace-only trailing lines.
  while (/^\s*$/.test(lines[lines.length - 1])) {
    lines.pop();
  }

  let cooked = lines.join('\n');
  if (addNewlines) {
    cooked = `\n${cooked}\n`;
  }

  // The `\` -> `\\` replacement must occur first so that the backslashes
  // introduced by later replacements are not replaced.
  const raw = cooked.replace(/<\/script/g, '&lt;/script')
                  .replace(/\\/g, '\\\\')
                  .replace(/`/g, '\\`')
                  .replace(/\$/g, '\\$');

  return jsc.templateLiteral([jsc.templateElement({cooked, raw}, true)], []);
}

/**
 * Returns an array of identifiers if an expression is a chain of property
 * access, as used in namespace-style exports.
 */
export function getMemberPath(expression: estree.Node): string[]|undefined {
  if (expression.type !== 'MemberExpression' || expression.computed ||
      expression.property.type !== 'Identifier') {
    return;
  }
  const property = expression.property.name;

  if (expression.object.type === 'ThisExpression') {
    return ['this', property];
  } else if (expression.object.type === 'Identifier') {
    if (expression.object.name === 'window') {
      return [property];
    } else {
      return [expression.object.name, property];
    }
  } else if (expression.object.type === 'MemberExpression') {
    const prefixPath = getMemberPath(expression.object);
    if (prefixPath !== undefined) {
      return [...prefixPath, property];
    }
  }
  return undefined;
}

/** Like getMemberPath but joins the name back up into a single string. */
export function getMemberName(expression: estree.Node): string|undefined {
  const path = getMemberPath(expression);
  return path ? path.join('.') : path;
}

export function getMemberOrIdentifierName(expression: estree.Node): string|
    undefined {
  if (expression.type === 'Identifier') {
    return expression.name;
  }
  return getMemberName(expression);
}

/**
 * Find the node in program that corresponds to the same part of code
 * as the given node.
 *
 * This method is necessary because program is parsed locally, but the
 * given node may have come from the analyzer (so a different parse run,
 * possibly by a different parser, though they output the same format).
 */
export function getNodeGivenAnalyzerAstNode(
    program: estree.Program, node: estree.Node) {
  const nodePath = getNodePathGivenAnalyzerAstNode(program, node);
  return nodePath ? nodePath.node : undefined;
}

/** Like `getNode`, but returns the `NodePath` for mutating the AST. */
export function getNodePathGivenAnalyzerAstNode(
    program: estree.Program, node: estree.Node) {
  let associatedNodePath: NodePath|undefined;

  astTypes.visit(program, {
    visitNode(path: NodePath<estree.Node>): boolean |
    undefined {
      // Traverse first, because we want the most specific node that exactly
      // matches the given node.
      this.traverse(path);
      if (associatedNodePath === undefined &&
          sourceLocationsEqual(path.node, node) &&
          path.node.type === node.type) {
        associatedNodePath = path;
        return false;
      }
      return undefined;
    }
  });

  return associatedNodePath;
}

/**
 * Yields the NodePath for each statement at the top level of `program`.
 *
 * Like `yield* program.body` except it yields NodePaths rather than
 * Nodes, so that the caller can mutate the AST with the NodePath api.
 */
export function* toplevelStatements(program: estree.Program) {
  const nodePaths: NodePath[] = [];
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
      nodePaths.push(path);
      return;
    }
  });
  yield* nodePaths;
}

/**
 * Returns true if a statement is the literal "use strict".
 */
export function isUseStrict(statement: estree.Statement) {
  return statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'Literal' &&
      statement.expression.value === 'use strict';
}

export function getNamespaces(analysis: Analysis) {
  return IterableX
      .from(analysis.getFeatures(
          {kind: 'namespace', externalPackages: true, imported: true}))
      .map((n) => {
        const name = n.name;
        if (name.startsWith('window.')) {
          return name.slice('window.'.length);
        }
        return name;
      });
}

/**
 * Write each file to the out-directory.
 */
export async function writeFileResults(
    outDir: string, files: Map<ConvertedDocumentFilePath, string|undefined>) {
  return Promise.all(IterableX.from(files).map(async ([newPath, newSource]) => {
    const filePath = path.join(outDir, newPath);
    await mkdirp(path.dirname(filePath));
    if (newSource !== undefined) {
      await fs.writeFile(filePath, newSource);
    } else if (await fs.exists(filePath)) {
      await fs.unlink(filePath);
    }
  }));
}
