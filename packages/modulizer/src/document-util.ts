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
import {EOL} from 'os';
import * as parse5 from 'parse5';
import {AstNodeWithLanguage} from 'polymer-analyzer';
import {babelNodeToEstreeNode} from './util';

/**
 * Serialize a parse5 Node to a string.
 */
export function serializeNode(node: parse5.ASTNode): string {
  const container = parse5.treeAdapters.default.createDocumentFragment();
  dom5.append(container, node);
  return parse5.serialize(container);
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

/**
 * Detect if two Node's have the same source location.
 */
export function isSourceLocationEqual(a: estree.Node, b: estree.Node): boolean {
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

/**
 * Serialize a Node to string, wrapped as an estree template literal.
 */
export function serializeNodeToTemplateLiteral(
    node: parse5.ASTNode, addNewLines = true) {
  const lines = parse5.serialize(node).split('\n');

  // Remove empty / whitespace-only leading lines.
  while (/^\s*$/.test(lines[0])) {
    lines.shift();
  }
  // Remove empty / whitespace-only trailing lines.
  while (/^\s*$/.test(lines[lines.length - 1])) {
    lines.pop();
  }

  let cooked = lines.join(EOL);
  if (addNewLines) {
    cooked = `${EOL}${cooked}${EOL}`;
  }

  // The `\` -> `\\` replacement must occur first so that the backslashes
  // introduced by later replacements are not replaced.
  const raw = cooked.replace(/(<\/script|\\|`|\$)/g, (_match, group) => {
    switch (group) {
      case `<\/script`:
        return '&lt;/script';
      case '\\':
        return '\\\\';
      case '`':
        return '\\`';
      case '$':
        return '\\$';
      default:
        throw new Error(`oops!: ${group}`);
    }
  });

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


/**
 * Returns a string of identifiers (dot-seperated) if an expression is a chain
 * of property access, as used in namespace-style exports.
 */
export function getMemberName(expression: estree.Node): string|undefined {
  const path = getMemberPath(expression);
  return path ? path.join('.') : path;
}

/**
 * Returns an Identifier's name if Node is a simple Identifier. Otherwise,
 * get the full member name.
 */
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
export function getNodePathInProgram(
    program: estree.Program, astNode: AstNodeWithLanguage|undefined) {
  if (astNode === undefined || astNode.language !== 'js') {
    return;
  }
  const node = astNode.node;
  let associatedNodePath: NodePath|undefined;

  astTypes.visit(program, {
    visitNode(path: NodePath<estree.Node>): boolean |
    undefined {
      // Traverse first, because we want the most specific node that exactly
      // matches the given node.
      this.traverse(path);
      if (associatedNodePath === undefined &&
          isSourceLocationEqual(path.node, babelNodeToEstreeNode(node)) &&
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
export function* getTopLevelStatements(program: estree.Program) {
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
 * If the given NodePath Node is on the left side of an assignment expression,
 * return a NodePath object for that assignment expression.
 *
 * Examples where the assignment expression is returned for `foo`:
 *
 *    foo = 10;
 *    window.foo = 10;
 *
 * Examples where an assignment expression is NOT matched:
 *
 *     bar = foo;
 *     foo();
 *     const foo = 10;
 *     this.foo = 10;
 */
export function getPathOfAssignmentTo(path: NodePath):
    NodePath<estree.AssignmentExpression>|undefined {
  if (!path.parent) {
    return undefined;
  }
  const parentNode = path.parent.node;
  if (parentNode.type === 'AssignmentExpression') {
    if (parentNode.left === path.node) {
      return path.parent as NodePath<estree.AssignmentExpression>;
    }
    return undefined;
  }
  if (parentNode.type === 'MemberExpression' &&
      parentNode.property === path.node &&
      parentNode.object.type === 'Identifier' &&
      parentNode.object.name === 'window') {
    return getPathOfAssignmentTo(path.parent);
  }
  return undefined;
}

/**
 * Give the name of the setter we should use to set the given memberPath. Does
 * not check to see if the setter exists, just returns the name it would have.
 * e.g.
 *
 *     ['Polymer', 'foo', 'bar']    =>    'Polymer.foo.setBar'
 */
export function getSetterName(memberPath: string[]): string {
  const lastSegment = memberPath[memberPath.length - 1];
  memberPath[memberPath.length - 1] =
      `set${lastSegment.charAt(0).toUpperCase()}${lastSegment.slice(1)}`;
  return memberPath.join('.');
}

export function filterClone(
    nodes: parse5.ASTNode[], filter: dom5.Predicate): parse5.ASTNode[] {
  const clones = [];
  for (const node of nodes) {
    if (!filter(node)) {
      continue;
    }
    const clone = dom5.cloneNode(node);
    clones.push(clone);
    if (node.childNodes) {
      clone.childNodes = filterClone(node.childNodes, filter);
    }
  }
  return clones;
}

/**
 * Finds all identifiers within the given program and creates a set of their
 * names (strings). Identifiers in the `ignored` argument set will not
 * contribute to the output set.
 */
export function collectIdentifierNames(
    program: estree.Program,
    ignored: ReadonlySet<estree.Identifier>): Set<string> {
  const identifiers = new Set();
  astTypes.visit(program, {
    visitIdentifier(path: NodePath<estree.Identifier>): (boolean | void) {
      const node = path.node;

      if (!ignored.has(node)) {
        identifiers.add(path.node.name);
      }

      this.traverse(path);
    },
  });
  return identifiers;
}

/**
 * Returns true if a dom module ASTNode is eligible for inlining.
 */
export function canDomModuleBeInlined(domModule: parse5.ASTNode) {
  if (domModule.attrs.some((a) => a.name !== 'id')) {
    return false;  // attributes other than 'id' on dom-module
  }
  let templateTagsSeen = 0;
  for (const node of domModule.childNodes || []) {
    if (node.tagName === 'template') {
      if (node.attrs.length > 0) {
        return false;  // attributes on template
      }
      templateTagsSeen++;
    } else if (node.tagName === 'script') {
      // this is fine, scripts are handled elsewhere
    } else if (
        dom5.isTextNode(node) && dom5.getTextContent(node).trim() === '') {
      // empty text nodes are fine
    } else {
      return false;  // anything else, we can't convert it
    }
  }
  if (templateTagsSeen > 1) {
    return false;  // more than one template tag, can't convert
  }

  return true;
}

/**
 * Yields all nodes inside the given node in top-down, first-to-last order.
 */
function* nodesInside(node: parse5.ASTNode): Iterable<parse5.ASTNode> {
  const childNodes = parse5.treeAdapters.default.getChildNodes(node);
  if (childNodes === undefined) {
    return;
  }
  for (const child of childNodes) {
    yield child;
    yield* nodesInside(child);
  }
}

/**
 * Yields all nodes that come after the given node, including later siblings
 * of ancestors.
 */
function* nodesAfter(node: parse5.ASTNode): Iterable<parse5.ASTNode> {
  const parentNode = node.parentNode;
  if (!parentNode) {
    return;
  }
  const siblings = parse5.treeAdapters.default.getChildNodes(parentNode);
  for (let i = siblings.indexOf(node) + 1; i < siblings.length; i++) {
    const laterSibling = siblings[i];
    yield laterSibling;
    yield* nodesInside(laterSibling);
  }
  yield* nodesAfter(parentNode);
}

/**
 * Returns the text of all comments in the document between the two optional
 * points.
 *
 * If `from` is given, returns all comments after `from` in the document.
 * If `until` is given, returns all comments up to `until` in the document.
 */
export function getCommentsBetween(
    document: parse5.ASTNode,
    from: parse5.ASTNode|undefined,
    until: parse5.ASTNode|undefined): string[] {
  const nodesStart =
      from === undefined ? nodesInside(document) : nodesAfter(from);
  const nodesBetween =
      IterableX.from(nodesStart).takeWhile((node) => node !== until);
  const commentNodesBetween =
      nodesBetween.filter((node) => dom5.isCommentNode(node));
  const commentStringsBetween =
      commentNodesBetween.map((node) => dom5.getTextContent(node));
  const formattedCommentStringsBetween =
      commentStringsBetween.map((commentText) => {
        // If it looks like there might be jsdoc in the comment, start the
        // comment with an extra * so that the js comment looks like a jsdoc
        // comment.
        if (/@\w+/.test(commentText)) {
          return '*' + commentText;
        }
        return commentText;
      });
  return Array.from(formattedCommentStringsBetween);
}

/** Recast represents comments differently than espree. */
interface RecastNode {
  comments?: null|undefined|Array<RecastComment>;
}

interface RecastComment {
  type: 'Line'|'Block';
  leading: boolean;
  trailing: boolean;
  value: string;
}

/**
 * Given some comments, attach them to the first statement, if any, in the
 * given array of statements.
 *
 * If there is no first statement, one will be created.
 */
export function attachCommentsToFirstStatement(
    comments: string[],
    statements: Array<estree.Statement|estree.ModuleDeclaration>) {
  if (comments.length === 0) {
    return;
  }
  // A license comment is appropriate at the top of a file. Anything else
  //   should be checked.
  if (comments.filter((c) => !/@license/.test(c)).length > 0) {
    const message =
        `\n  FIXME(polymer-modulizer): the above comments were extracted\n` +
        `  from HTML and may be out of place here. Review them and\n` +
        `  then delete this comment!\n`;
    comments.push(message);
  }

  const recastComments = getCommentsFromTexts(comments);
  let firstStatement: RecastNode&(estree.Statement | estree.ModuleDeclaration) =
      statements[0];
  if (firstStatement === undefined) {
    firstStatement = jsc.expressionStatement(jsc.identifier(''));
    statements.unshift(firstStatement);
  }

  firstStatement.comments =
      recastComments.concat(firstStatement.comments || []);
}

export function attachCommentsToEndOfProgram(
    comments: string[],
    statements: Array<estree.Statement|estree.ModuleDeclaration>) {
  if (comments.length === 0) {
    return;
  }
  const message =
      `\n  FIXME(polymer-modulizer): the above comments were extracted\n` +
      `  from HTML and may be out of place here. Review them and\n` +
      `  then delete this comment!\n`;
  comments.push(message);

  const recastComments = getCommentsFromTexts(comments);
  const lastStatement =
      jsc.expressionStatement(jsc.identifier('')) as RecastNode &
      estree.Statement;
  lastStatement.comments =
      (lastStatement.comments || []).concat(recastComments);
  statements.push(lastStatement);
}

function getCommentsFromTexts(commentTexts: string[]) {
  const recastComments: RecastComment[] = commentTexts.map((comment) => {
    const escapedComment = comment.replace(/\*\//g, '*\\/');
    return {
      type: 'Block' as 'Block',
      leading: true,
      trailing: false,
      value: escapedComment,
    };
  });
  return recastComments;
}

/**
 * Returns true if the given program contains any expressions that write to the
 * global "settings" object.
 */
export function containsWriteToGlobalSettingsObject(program: estree.Program) {
  let containsWriteToGlobalSettingsObject = false;
  // Note that we look for writes to these objects exactly, not to writes to
  // members of these objects.
  const globalSettingsObjects =
      new Set<string>(['Polymer', 'Polymer.Settings', 'ShadyDOM']);

  function getNamespacedName(node: estree.Node) {
    if (node.type === 'Identifier') {
      return node.name;
    }
    const memberPath = getMemberPath(node);
    if (memberPath) {
      return memberPath.join('.');
    }
    return undefined;
  }
  astTypes.visit(program, {
    visitAssignmentExpression(path: NodePath<estree.AssignmentExpression>) {
      const name = getNamespacedName(path.node.left);
      if (globalSettingsObjects.has(name!)) {
        containsWriteToGlobalSettingsObject = true;
      }
      return false;
    },
  });

  return containsWriteToGlobalSettingsObject;
}

/**
 * Create an array of statements that correctly insert the given parse5 (HTML)
 * nodes into JavaScript.
 */
export function createDomNodeInsertStatements(
    nodes: parse5.ASTNode[], activeInBody = false): estree.Statement[] {
  const varName = `$_documentContainer`;
  const fragment = {
    nodeName: '#document-fragment',
    attrs: [],
    childNodes: nodes,
    __location: {} as parse5.ElementLocationInfo,
  };
  const templateValue = serializeNodeToTemplateLiteral(fragment, false);

  const createElementTemplate = jsc.variableDeclaration(
      'const',
      [jsc.variableDeclarator(
          jsc.identifier(varName),
          jsc.callExpression(
              jsc.memberExpression(
                  jsc.identifier('document'), jsc.identifier('createElement')),
              [jsc.literal('template')]))]);
  const setDocumentContainerStatement =
      jsc.expressionStatement(jsc.assignmentExpression(
          '=',
          jsc.memberExpression(
              jsc.identifier(varName), jsc.identifier('innerHTML')),
          templateValue));
  const targetNode = activeInBody ? 'body' : 'head';
  return [
    createElementTemplate,
    setDocumentContainerStatement,
    jsc.expressionStatement(jsc.callExpression(
        jsc.memberExpression(
            jsc.memberExpression(
                jsc.identifier('document'), jsc.identifier(targetNode)),
            jsc.identifier('appendChild')),
        [jsc.memberExpression(
            jsc.identifier(varName), jsc.identifier('content'))]))
  ];
}

/**
 * Insert an array of statements into the program at the correct location. The
 * correct location for new statements is after ImportDeclarations, if any
 * exist.
 */
export function insertStatementsIntoProgramBody(
    statements: estree.Statement[], program: estree.Program) {
  let insertionPoint = 0;
  for (let i = 0; i < program.body.length; i++) {
    const bodyStatement = program.body[i];
    if (bodyStatement.type === 'ImportDeclaration') {
      // cover the case where the import is at the end
      insertionPoint = i + 1;
    } else {
      // otherwise, break
      insertionPoint = i;
      break;
    }
  }
  program.body.splice(insertionPoint, 0, ...statements);
}
