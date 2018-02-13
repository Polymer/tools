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

import {ASTNode as Node, treeAdapters} from 'parse5';

import {isElement, Predicate, predicates as p} from './predicates';

export {ASTNode as Node} from 'parse5';

/**
 * Applies `mapfn` to `node` and the tree below `node`, returning a flattened
 * list of results.
 */
export function treeMap<U>(node: Node, mapfn: (node: Node) => U[]): U[] {
  let results: U[] = [];
  nodeWalk(node, function(node) {
    results = results.concat(mapfn(node));
    return false;
  });
  return results;
}

export type GetChildNodes = (node: Node) => Node[] | undefined;

export const defaultChildNodes: GetChildNodes = node => node.childNodes;

export const childNodesIncludeTemplate: GetChildNodes = node => {
  if (node.nodeName === 'template') {
    return treeAdapters.default.getTemplateContent(node).childNodes;
  }

  return node.childNodes;
};

/**
 * Walk the tree down from `node`, applying the `predicate` function.
 * Return the first node that matches the given predicate.
 *
 * @returns `null` if no node matches, parse5 node object if a node matches.
 */
export function nodeWalk(
    node: Node,
    predicate: Predicate,
    getChildNodes: GetChildNodes = defaultChildNodes): Node|null {
  if (predicate(node)) {
    return node;
  }
  let match: Node|null = null;
  const childNodes = getChildNodes(node);
  if (childNodes) {
    for (let i = 0; i < childNodes.length; i++) {
      match = nodeWalk(childNodes[i], predicate, getChildNodes);
      if (match) {
        break;
      }
    }
  }
  return match;
}

/**
 * Walk the tree down from `node`, applying the `predicate` function.
 * All nodes matching the predicate function from `node` to leaves will be
 * returned.
 */
export function nodeWalkAll(
    node: Node,
    predicate: Predicate,
    matches?: Node[],
    getChildNodes: GetChildNodes = defaultChildNodes): Node[] {
  if (!matches) {
    matches = [];
  }
  if (predicate(node)) {
    matches.push(node);
  }
  const childNodes = getChildNodes(node);
  if (childNodes) {
    for (let i = 0; i < childNodes.length; i++) {
      nodeWalkAll(childNodes[i], predicate, matches, getChildNodes);
    }
  }
  return matches;
}

function _reverseNodeWalkAll(
    node: Node,
    predicate: Predicate,
    matches: Node[],
    getChildNodes: GetChildNodes = defaultChildNodes): Node[] {
  if (!matches) {
    matches = [];
  }
  const childNodes = getChildNodes(node);
  if (childNodes) {
    for (let i = childNodes.length - 1; i >= 0; i--) {
      nodeWalkAll(childNodes[i], predicate, matches, getChildNodes);
    }
  }
  if (predicate(node)) {
    matches.push(node);
  }
  return matches;
}

/**
 * Equivalent to `nodeWalk`, but only returns nodes that are either
 * ancestors or earlier cousins/siblings in the document.
 *
 * Nodes are searched in reverse document order, starting from the sibling
 * prior to `node`.
 */
export function nodeWalkPrior(node: Node, predicate: Predicate): Node|
    undefined {
  // Search our earlier siblings and their descendents.
  const parent = node.parentNode;
  if (parent && parent.childNodes) {
    const idx = parent.childNodes.indexOf(node);
    const siblings = parent.childNodes.slice(0, idx);
    for (let i = siblings.length - 1; i >= 0; i--) {
      const sibling = siblings[i];
      if (predicate(sibling)) {
        return sibling;
      }
      const found = nodeWalk(sibling, predicate);
      if (found) {
        return found;
      }
    }
    if (predicate(parent)) {
      return parent;
    }
    return nodeWalkPrior(parent, predicate);
  }
  return undefined;
}

/**
 * Walk the tree up from the parent of `node`, to its grandparent and so on to
 * the root of the tree.  Return the first ancestor that matches the given
 * predicate.
 */
export function nodeWalkAncestors(node: Node, predicate: Predicate): Node|
    undefined {
  const parent = node.parentNode;
  if (!parent) {
    return undefined;
  }
  if (predicate(parent)) {
    return parent;
  }
  return nodeWalkAncestors(parent, predicate);
}

/**
 * Equivalent to `nodeWalkAll`, but only returns nodes that are either
 * ancestors or earlier cousins/siblings in the document.
 *
 * Nodes are returned in reverse document order, starting from `node`.
 */
export function nodeWalkAllPrior(
    node: Node, predicate: Predicate, matches?: Node[]): Node[] {
  if (!matches) {
    matches = [];
  }
  if (predicate(node)) {
    matches.push(node);
  }
  // Search our earlier siblings and their descendents.
  const parent = node.parentNode;
  if (parent) {
    const idx = parent.childNodes!.indexOf(node);
    const siblings = parent.childNodes!.slice(0, idx);
    for (let i = siblings.length - 1; i >= 0; i--) {
      _reverseNodeWalkAll(siblings[i], predicate, matches);
    }
    nodeWalkAllPrior(parent, predicate, matches);
  }
  return matches;
}

/**
 * Equivalent to `nodeWalk`, but only matches elements
 */
export function query(
    node: Node,
    predicate: Predicate,
    getChildNodes: GetChildNodes = defaultChildNodes): Node|null {
  const elementPredicate = p.AND(isElement, predicate);
  return nodeWalk(node, elementPredicate, getChildNodes);
}

/**
 * Equivalent to `nodeWalkAll`, but only matches elements
 */
export function queryAll(
    node: Node,
    predicate: Predicate,
    matches?: Node[],
    getChildNodes: GetChildNodes = defaultChildNodes): Node[] {
  const elementPredicate = p.AND(isElement, predicate);
  return nodeWalkAll(node, elementPredicate, matches, getChildNodes);
}
