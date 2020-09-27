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
import {
  DefaultTreeNode as Node,
  DefaultTreeTextNode as TextNode,
  DefaultTreeElement as Element,
  DefaultTreeDocumentFragment as DocumentFragment,
  DefaultTreeCommentNode as CommentNode,
  DefaultTreeParentNode as ParentNode,
  DefaultTreeChildNode as ChildNode
} from 'parse5';

import {isChildNode, isDocumentFragment, predicates as p} from './predicates';
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
  return {
    nodeName: '#document-fragment',
    childNodes: []
  };
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
    parent: ParentNode, index: number, newNode: Node, replace?: boolean) {
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

  newNodes.forEach((n) => {
    (n as ChildNode).parentNode = parent;
  });

  if (removedNode) {
    (removedNode as ChildNode).parentNode = undefined as unknown as ParentNode;
  }
}

export function replace(oldNode: Node, newNode: Node) {
  // we can't replace something that isn't a child of anything.
  if (!isChildNode(oldNode)) {
    return;
  }
  const parent = oldNode.parentNode;
  const index = parent.childNodes.indexOf(oldNode);
  insertNode(parent, index, newNode, true);
}

export function remove(node: Node) {
  // if it isn't a child, there's nothing to remove it from
  if (!isChildNode(node)) {
    return;
  }
  const parent = node.parentNode;
  if (parent && parent.childNodes) {
    const idx = parent.childNodes.indexOf(node);
    parent.childNodes.splice(idx, 1);
  }
  node.parentNode = undefined as unknown as ParentNode;
}

export function insertBefore(parent: ParentNode, target: Node, newNode: Node) {
  const index = parent.childNodes.indexOf(target);
  insertNode(parent, index, newNode);
}

export function insertAfter(parent: ParentNode, target: Node, newNode: Node) {
  const index = parent.childNodes.indexOf(target);
  insertNode(parent, index + 1, newNode);
}

/**
 * Removes a node and places its children in its place.  If the node
 * has no parent, the operation is impossible and no action takes place.
 */
export function removeNodeSaveChildren(node: ParentNode & ChildNode) {
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
      p.AND(
          (node) => !node.__location,
          p.hasMatchingTagName(/^(html|head|body)$/i)),
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

export const constructors = {
  text: newTextNode,
  comment: newCommentNode,
  element: newElement,
  fragment: newDocumentFragment,
};
