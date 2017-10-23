/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import {ASTNode} from 'parse5';
import * as util from 'util';

import {isFakeNode} from '../html/html-document';
import * as jsdoc from '../javascript/jsdoc';

import {Document, ScannedDocument} from './document';
import {ScannedFeature} from './feature';
import {unsafeAsMutable} from './immutable';
import {Resolvable} from './resolvable';
import {LocationOffset, SourceRange} from './source-range';
import {Warning} from './warning';

export interface InlineDocInfo<AstNode> {
  astNode?: AstNode;
  locationOffset?: LocationOffset;
}

/**
 * Represents an inline document, usually a <script> or <style> tag in an HTML
 * document.
 *
 * @template N The AST node type
 */
export class ScannedInlineDocument implements ScannedFeature, Resolvable {
  type: 'html'|'js'|'css'|/* etc */ string;

  contents: string;

  /** The location offset of this document within the containing document. */
  locationOffset: LocationOffset;
  attachedComment?: string;

  scannedDocument?: ScannedDocument;

  sourceRange: SourceRange;
  warnings: Warning[] = [];

  astNode: dom5.Node;

  constructor(
      type: string, contents: string, locationOffset: LocationOffset,
      attachedComment: string, sourceRange: SourceRange, ast: dom5.Node) {
    this.type = type;
    this.contents = contents;
    this.locationOffset = locationOffset;
    this.attachedComment = attachedComment;
    this.sourceRange = sourceRange;
    this.astNode = ast;
  }

  resolve(document: Document): Document|undefined {
    if (!this.scannedDocument) {
      // Parse error on the inline document.
      return;
    }
    const inlineDocument = new InlineDocument(this.scannedDocument, document);
    inlineDocument.resolve();
    return inlineDocument;
  }
}

declare module './queryable' {
  interface FeatureKindMap {
    'inline-document': InlineDocument;
  }
}
export class InlineDocument extends Document {
  constructor(base: ScannedDocument, containerDocument: Document) {
    super(base, containerDocument._analysisContext);
    unsafeAsMutable(this.kinds).add('inline-document');
    this._addFeature(containerDocument);
  }
}

export function getAttachedCommentText(node: ASTNode): string|undefined {
  const commentNode = getAttachedCommentNode(node);
  if (!commentNode) {
    return;
  }
  const comment = dom5.getTextContent(commentNode);
  if (!comment || /@license/.test(comment)) {
    return;
  }
  return jsdoc.unindent(comment).trim();
}

function getAttachedCommentNode(node: ASTNode): ASTNode|undefined {
  const predecessors = getPreviousSiblings(node);
  const visiblePredecessors = filterOutInvisibleNodes(predecessors);
  const [closestVisiblePredecessor] = visiblePredecessors;
  if (!closestVisiblePredecessor) {
    return;  // no predecessors at all
  }
  if (!dom5.isCommentNode(closestVisiblePredecessor)) {
    return;  // attached node isn't a comment
  }
  return closestVisiblePredecessor;
}

/**
 * Filter out nodes that are just whitespace, or aren't present in the original
 * source text of the file.
 */
function*
    filterOutInvisibleNodes(nodeIter: Iterable<ASTNode>): Iterable<ASTNode> {
  for (const node of nodeIter) {
    // Ignore nodes that aren't present in the original text of the file,
    // like parser-hallucinated <head> and <body> nodes.
    if (isFakeNode(node)) {
      continue;
    }
    // Ignore text nodes that are just whitespace
    if (dom5.isTextNode(node)) {
      const text = dom5.getTextContent(node).trim();
      if (text === '') {
        continue;
      }
    }
    yield node;
  }
}

/**
 * An iterable over siblings that come before the given node.
 *
 * Note that this method gives siblings from the author's point of view, not
 * the pedantic parser's point of view, so we need to traverse some fake
 * nodes. e.g. consider this document
 *
 *     <link rel="import" href="foo.html">
 *     <dom-module></dom-module>
 *
 * For this method's purposes, these nodes are siblings, but in the AST
 * they're actually cousins! The link is in a hallucinated <head> node, and
 * the dom-module is in a hallucinated <body> node, so to get to the link we
 * need to go up to the body, then back to the head, then back down, but
 * only if the head and body are hallucinated.
 */
function* getPreviousSiblings(node: ASTNode): Iterable<ASTNode> {
  const parent = node.parentNode;
  if (parent) {
    const siblings = parent.childNodes!;
    for (let i = siblings.indexOf(node) - 1; i >= 0; i--) {
      const predecessor = siblings[i];
      if (isFakeNode(predecessor)) {
        if (predecessor.childNodes) {
          yield* iterReverse(predecessor.childNodes);
        }
      } else {
        yield predecessor;
      }
    }
    if (isFakeNode(parent)) {
      yield* getPreviousSiblings(parent);
    }
  }
}

function* iterReverse<V>(arr: Array<V>): Iterable<V> {
  for (let i = arr.length - 1; i >= 0; i--) {
    yield arr[i];
  }
}

function isLocationInfo(loc: (parse5.LocationInfo|parse5.ElementLocationInfo)):
    loc is parse5.LocationInfo {
  return 'line' in loc;
}

export function getLocationOffsetOfStartOfTextContent(node: ASTNode):
    LocationOffset {
  const childNodes = node.childNodes || [];
  const firstChildNodeWithLocation = childNodes.find((n) => !!n.__location);
  const bestLocation = firstChildNodeWithLocation ?
      firstChildNodeWithLocation.__location :
      node.__location;
  if (!bestLocation) {
    throw new Error(
        `Couldn't extract a location offset from HTML node: ` +
        `${util.inspect(node)}`);
  }
  if (isLocationInfo(bestLocation)) {
    return {line: bestLocation.line - 1, col: bestLocation.col - 1};
  } else {
    return {
      line: bestLocation.startTag.line - 1,
      col: bestLocation.startTag.endOffset - 1,
    };
  }
}
