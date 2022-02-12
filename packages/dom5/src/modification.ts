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
import * as cloneObject from 'clone';
import {ChildNode, CommentNode, DocumentFragment, Element, Node, ParentNode, TextNode} from 'parse5';

import {
  isChildNode,
  isParentNode,
  isDocumentFragment,
  predicates as p
} from './predicates';
import {queryAll} from './walking';

export {Node};

function newTextNode(value: string): TextNode {
  return {
    nodeName: '#text',
    value: value,
    // TODO (43081j): maybe pass in what we're going to append it to?
    parentNode: undefined as unknown as ParentNode
  };
}

function newCommentNode(comment: string): CommentNode {
  return {
    nodeName: '#comment',
    data: comment,
    parentNode: undefined as unknown as ParentNode
  };
}

function newElement(tagName: string, namespace?: string): Element {
  return {
    nodeName: tagName,
    tagName: tagName,
    childNodes: [],
    namespaceURI: namespace || 'http://www.w3.org/1999/xhtml',
    attrs: [],
    parentNode: undefined as unknown as ParentNode
  };
}

function newDocumentFragment(): DocumentFragment {
  return {nodeName: '#document-fragment', childNodes: []};
}

export function cloneNode<T extends Node>(node: T): T {
  // parent is a backreference, and we don't want to clone the whole tree, so
  // make it null before cloning.
  let clone;

  if (isChildNode(node)) {
    const parent = node.parentNode;
    node.parentNode = undefined as unknown as ParentNode;
    clone = cloneObject(node);
    node.parentNode = parent;
  } else {
    clone = cloneObject(node);
  }
  return clone;
}

/**
 * Inserts `newNode` into `parent` at `index`, optionally replacing the
 * current node at `index`. If `newNode` is a DocumentFragment, its childNodes
 * are inserted and removed from the fragment.
 */
function insertNode(
    parent: ParentNode, index: number, newNode: ChildNode|DocumentFragment, replace?: boolean) {
  let newNodes: Node[] = [];

  if (newNode) {
    if (isDocumentFragment(newNode)) {
      newNodes = Array.from(newNode.childNodes);
      newNode.childNodes.length = 0;
    } else {
      newNodes = [newNode];
      remove(newNode);
    }
  }

  const removedNode = replace ? parent.childNodes[index] : null;

  Array.prototype.splice.apply(
      parent.childNodes, (<any>[index, replace ? 1 : 0]).concat(newNodes));

  newNodes.forEach((n) => {
    (n as ChildNode).parentNode = parent;
  });

  if (removedNode) {
    removedNode.parentNode = undefined as unknown as ParentNode;
  }
}

export function replace(oldNode: ChildNode, newNode: ChildNode|DocumentFragment) {
  const parent = oldNode.parentNode;
  const index = parent.childNodes.indexOf(oldNode);
  insertNode(parent, index, newNode, true);
}

export function remove(node: ChildNode) {
  const parent = node.parentNode;
  if (parent) {
    const idx = parent.childNodes.indexOf(node);
    parent.childNodes.splice(idx, 1);
  }
  node.parentNode = undefined as unknown as ParentNode;
}

export function insertBefore(
    parent: ParentNode, target: ChildNode, newNode: ChildNode|DocumentFragment) {
  const index = parent.childNodes.indexOf(target);
  insertNode(parent, index, newNode);
}

export function insertAfter(
    parent: ParentNode, target: ChildNode, newNode: ChildNode|DocumentFragment) {
  const index = parent.childNodes.indexOf(target);
  insertNode(parent, index + 1, newNode);
}

/**
 * Removes a node and places its children in its place.  If the node
 * has no parent, the operation is impossible and no action takes place.
 */
export function removeNodeSaveChildren(node: Element) {
  const children = node.childNodes.slice();
  for (const child of children) {
    insertBefore(node.parentNode, node, child);
  }
  remove(node);
}

/**
 * When parse5 parses an HTML document with `parse`, it injects missing root
 * elements (html, head and body) if they are missing.  This function removes
 * these from the AST if they have no location info, so it requires that
 * the `parse5.parse` be used with the `locationInfo` option of `true`.
 */
export function removeFakeRootElements(ast: ParentNode) {
  const injectedNodes = queryAll(
      ast,
      p.AND(
          (node) => !(node as Element).sourceCodeLocation,
          p.hasMatchingTagName(/^(html|head|body)$/i)),
      undefined,
      // Don't descend past 3 levels 'document > html > head|body'
      (node: Node) => {
        return isChildNode(node) && node.parentNode &&
                isChildNode(node.parentNode) && node.parentNode.parentNode ?
            undefined :
            (node as ParentNode).childNodes;
      });
  injectedNodes.reverse().forEach(removeNodeSaveChildren);
}

export function append(parent: ParentNode, newNode: ChildNode|DocumentFragment) {
  const index = parent.childNodes.length;
  insertNode(parent, index, newNode);
}

export const constructors = {
  text: newTextNode,
  comment: newCommentNode,
  element: newElement,
  fragment: newDocumentFragment,
};
