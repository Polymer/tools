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

import * as cloneObject from 'clone';
import {ASTNode as Node, treeAdapters} from 'parse5';
export {ASTNode as Node} from 'parse5';

function getAttributeIndex(element: Node, name: string): number {
  if (!element.attrs) {
    return -1;
  }
  const n = name.toLowerCase();
  for (let i = 0; i < element.attrs.length; i++) {
    if (element.attrs[i].name.toLowerCase() === n) {
      return i;
    }
  }
  return -1;
}

/**
 * @returns `true` iff [element] has the attribute [name], `false` otherwise.
 */
export function hasAttribute(element: Node, name: string): boolean {
  return getAttributeIndex(element, name) !== -1;
}

export function hasSpaceSeparatedAttrValue(
    name: string, value: string): Predicate {
  return function(element: Node) {
    const attributeValue = getAttribute(element, name);
    if (typeof attributeValue !== 'string') {
      return false;
    }
    return attributeValue.split(' ').indexOf(value) !== -1;
  };
}


/**
 * @returns The string value of attribute `name`, or `null`.
 */
export function getAttribute(element: Node, name: string): string|null {
  const i = getAttributeIndex(element, name);
  if (i > -1) {
    return element.attrs[i].value;
  }
  return null;
}

export function setAttribute(element: Node, name: string, value: string) {
  const i = getAttributeIndex(element, name);
  if (i > -1) {
    element.attrs[i].value = value;
  } else {
    element.attrs.push({name: name, value: value});
  }
}

export function removeAttribute(element: Node, name: string) {
  const i = getAttributeIndex(element, name);
  if (i > -1) {
    element.attrs.splice(i, 1);
  }
}

function hasTagName(name: string): Predicate {
  const n = name.toLowerCase();
  return function(node) {
    if (!node.tagName) {
      return false;
    }
    return node.tagName.toLowerCase() === n;
  };
}

/**
 * Returns true if `regex.match(tagName)` finds a match.
 *
 * This will use the lowercased tagName for comparison.
 */
function hasMatchingTagName(regex: RegExp): Predicate {
  return function(node) {
    if (!node.tagName) {
      return false;
    }
    return regex.test(node.tagName.toLowerCase());
  };
}

function hasClass(name: string): Predicate {
  return hasSpaceSeparatedAttrValue('class', name);
}

function collapseTextRange(parent: Node, start: number, end: number) {
  if (!parent.childNodes) {
    return;
  }
  let text = '';
  for (let i = start; i <= end; i++) {
    text += getTextContent(parent.childNodes[i]);
  }
  parent.childNodes.splice(start, (end - start) + 1);
  if (text) {
    const tn = newTextNode(text);
    tn.parentNode = parent;
    parent.childNodes.splice(start, 0, tn);
  }
}

/**
 * Normalize the text inside an element
 *
 * Equivalent to `element.normalize()` in the browser
 * See https://developer.mozilla.org/en-US/docs/Web/API/Node/normalize
 */
export function normalize(node: Node) {
  if (!(isElement(node) || isDocument(node) || isDocumentFragment(node))) {
    return;
  }
  if (!node.childNodes) {
    return;
  }
  let textRangeStart = -1;
  for (let i = node.childNodes.length - 1, n: Node; i >= 0; i--) {
    n = node.childNodes[i];
    if (isTextNode(n)) {
      if (textRangeStart === -1) {
        textRangeStart = i;
      }
      if (i === 0) {
        // collapse leading text nodes
        collapseTextRange(node, 0, textRangeStart);
      }
    } else {
      // recurse
      normalize(n);
      // collapse the range after this node
      if (textRangeStart > -1) {
        collapseTextRange(node, i + 1, textRangeStart);
        textRangeStart = -1;
      }
    }
  }
}

/**
 * Return the text value of a node or element
 *
 * Equivalent to `node.textContent` in the browser
 */
export function getTextContent(node: Node): string {
  if (isCommentNode(node)) {
    return node.data || '';
  }
  if (isTextNode(node)) {
    return node.value || '';
  }
  const subtree = nodeWalkAll(node, isTextNode);
  return subtree.map(getTextContent).join('');
}

/**
 * Set the text value of a node or element
 *
 * Equivalent to `node.textContent = value` in the browser
 */
export function setTextContent(node: Node, value: string) {
  if (isCommentNode(node)) {
    node.data = value;
  } else if (isTextNode(node)) {
    node.value = value;
  } else {
    const tn = newTextNode(value);
    tn.parentNode = node;
    node.childNodes = [tn];
  }
}

/**
 * Match the text inside an element, textnode, or comment
 *
 * Note: nodeWalkAll with hasTextValue may return an textnode and its parent if
 * the textnode is the only child in that parent.
 */
function hasTextValue(value: string): Predicate {
  return function(node) {
    return getTextContent(node) === value;
  };
}

export type Predicate = (node: Node) => boolean;

/**
 * OR an array of predicates
 */
function OR(...predicates: Predicate[]): Predicate;
function OR(/* ...rules */): Predicate {
  const rules = new Array<Predicate>(arguments.length);
  for (let i = 0; i < arguments.length; i++) {
    rules[i] = arguments[i];
  }
  return function(node) {
    for (let i = 0; i < rules.length; i++) {
      if (rules[i](node)) {
        return true;
      }
    }
    return false;
  };
}

/**
 * AND an array of predicates
 */
function AND(...predicates: Predicate[]): Predicate;
function AND(/* ...rules */): Predicate {
  const rules = new Array<Predicate>(arguments.length);
  for (let i = 0; i < arguments.length; i++) {
    rules[i] = arguments[i];
  }
  return function(node) {
    for (let i = 0; i < rules.length; i++) {
      if (!rules[i](node)) {
        return false;
      }
    }
    return true;
  };
}

/**
 * negate an individual predicate, or a group with AND or OR
 */
function NOT(predicateFn: Predicate): Predicate {
  return function(node) {
    return !predicateFn(node);
  };
}

/**
 * Returns a predicate that matches any node with a parent matching
 * `predicateFn`.
 */
function parentMatches(predicateFn: Predicate): Predicate {
  return function(node) {
    let parent = node.parentNode;
    while (parent !== undefined) {
      if (predicateFn(parent)) {
        return true;
      }
      parent = parent.parentNode;
    }
    return false;
  };
}

function hasAttr(attr: string): Predicate {
  return function(node) {
    return getAttributeIndex(node, attr) > -1;
  };
}

function hasAttrValue(attr: string, value: string): Predicate {
  return function(node) {
    return getAttribute(node, attr) === value;
  };
}

export function isDocument(node: Node): boolean {
  return node.nodeName === '#document';
}

export function isDocumentFragment(node: Node): boolean {
  return node.nodeName === '#document-fragment';
}

export function isElement(node: Node): boolean {
  return node.nodeName === node.tagName;
}

export function isTextNode(node: Node): boolean {
  return node.nodeName === '#text';
}

export function isCommentNode(node: Node): boolean {
  return node.nodeName === '#comment';
}

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

export type GetChildNodes = (node: Node) => Node[]|undefined;

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
  const elementPredicate = AND(isElement, predicate);
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
  const elementPredicate = AND(isElement, predicate);
  return nodeWalkAll(node, elementPredicate, matches, getChildNodes);
}

function newTextNode(value: string): Node {
  return {
    nodeName: '#text',
    value: value,
    parentNode: undefined,
    attrs: [],
    __location: <any>undefined,
  };
}

function newCommentNode(comment: string): Node {
  return {
    nodeName: '#comment',
    data: comment,
    parentNode: undefined,
    attrs: [],
    __location: <any>undefined
  };
}

function newElement(tagName: string, namespace?: string): Node {
  return {
    nodeName: tagName,
    tagName: tagName,
    childNodes: [],
    namespaceURI: namespace || 'http://www.w3.org/1999/xhtml',
    attrs: [],
    parentNode: undefined,
    __location: <any>undefined
  };
}

function newDocumentFragment(): Node {
  return {
    nodeName: '#document-fragment',
    childNodes: [],
    parentNode: undefined,
    quirksMode: false,
    // TODO(rictic): update parse5 typings upstream to mention that attrs and
    //     __location are optional and not always present.
    attrs: undefined as any,
    __location: null as any
  };
}

export function cloneNode(node: Node): Node {
  // parent is a backreference, and we don't want to clone the whole tree, so
  // make it null before cloning.
  const parent = node.parentNode;
  node.parentNode = undefined;
  const clone = cloneObject(node);
  node.parentNode = parent;
  return clone;
}

/**
 * Inserts `newNode` into `parent` at `index`, optionally replaceing the
 * current node at `index`. If `newNode` is a DocumentFragment, its childNodes
 * are inserted and removed from the fragment.
 */
function insertNode(
    parent: Node, index: number, newNode: Node, replace?: boolean) {
  if (!parent.childNodes) {
    parent.childNodes = [];
  }
  let newNodes: Node[] = [];
  let removedNode = replace ? parent.childNodes[index] : null;

  if (newNode) {
    if (isDocumentFragment(newNode)) {
      if (newNode.childNodes) {
        newNodes = Array.from(newNode.childNodes);
        newNode.childNodes.length = 0;
      }
    } else {
      newNodes = [newNode];
      remove(newNode);
    }
  }

  if (replace) {
    removedNode = parent.childNodes[index];
  }

  Array.prototype.splice.apply(
      parent.childNodes, (<any>[index, replace ? 1 : 0]).concat(newNodes));

  newNodes.forEach(function(n) {
    n.parentNode = parent;
  });

  if (removedNode) {
    removedNode.parentNode = undefined;
  }
}

export function replace(oldNode: Node, newNode: Node) {
  const parent = oldNode.parentNode;
  const index = parent!.childNodes!.indexOf(oldNode);
  insertNode(parent!, index, newNode, true);
}

export function remove(node: Node) {
  const parent = node.parentNode;
  if (parent && parent.childNodes) {
    const idx = parent.childNodes.indexOf(node);
    parent.childNodes.splice(idx, 1);
  }
  node.parentNode = undefined;
}

export function insertBefore(parent: Node, target: Node, newNode: Node) {
  const index = parent.childNodes!.indexOf(target);
  insertNode(parent, index, newNode);
}

export function insertAfter(parent: Node, target: Node, newNode: Node) {
  const index = parent.childNodes!.indexOf(target);
  insertNode(parent, index + 1, newNode);
}

/**
 * Removes a node and places its children in its place.  If the node
 * has no parent, the operation is impossible and no action takes place.
 */
export function removeNodeSaveChildren(node: Node) {
  // We can't save the children if there's no parent node to provide
  // for them.
  const fosterParent = node.parentNode;
  if (!fosterParent) {
    return;
  }
  const children = (node.childNodes || []).slice();
  for (const child of children) {
    insertBefore(node.parentNode!, node, child);
  }
  remove(node);
}

/**
 * When parse5 parses an HTML document with `parse`, it injects missing root
 * elements (html, head and body) if they are missing.  This function removes
 * these from the AST if they have no location info, so it requires that
 * the `parse5.parse` be used with the `locationInfo` option of `true`.
 */
export function removeFakeRootElements(ast: Node) {
  const injectedNodes = queryAll(
      ast,
      AND((node) => !node.__location,
          hasMatchingTagName(/^(html|head|body)$/i)),
      undefined,
      // Don't descend past 3 levels 'document > html > head|body'
      (node) => node.parentNode && node.parentNode.parentNode ?
          undefined :
          node.childNodes);
  injectedNodes.reverse().forEach(removeNodeSaveChildren);
}

export function append(parent: Node, newNode: Node) {
  const index = parent.childNodes && parent.childNodes.length || 0;
  insertNode(parent, index, newNode);
}

export const predicates = {
  hasClass: hasClass,
  hasAttr: hasAttr,
  hasAttrValue: hasAttrValue,
  hasMatchingTagName: hasMatchingTagName,
  hasSpaceSeparatedAttrValue: hasSpaceSeparatedAttrValue,
  hasTagName: hasTagName,
  hasTextValue: hasTextValue,
  AND: AND,
  OR: OR,
  NOT: NOT,
  parentMatches: parentMatches,
};
export const constructors = {
  text: newTextNode,
  comment: newCommentNode,
  element: newElement,
  fragment: newDocumentFragment,
};
