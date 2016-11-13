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

import * as jsdoc from '../javascript/jsdoc';
import {Warning} from '../warning/warning';

import {Document, ScannedDocument} from './document';
import {ScannedFeature} from './feature';
import {Resolvable} from './resolvable';
import {LocationOffset, SourceRange} from './source-range';

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
  type: 'html'|'javascript'|'css'|/* etc */ string;

  contents: string;

  /** The location offset of this document within the containing document. */
  locationOffset: LocationOffset;
  attachedComment?: string;

  scannedDocument?: ScannedDocument;

  sourceRange: SourceRange;
  warnings: Warning[] = [];

  astNode: dom5.Node;

  constructor(
      type: string,
      contents: string,
      locationOffset: LocationOffset,
      attachedComment: string,
      sourceRange: SourceRange,
      ast: dom5.Node) {
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

export class InlineDocument extends Document {
  constructor(base: ScannedDocument, containerDocument: Document) {
    super(base, containerDocument.analyzer);
    this.kinds.add('inline-document');
    this._addFeature(containerDocument);
  }
}

export function getAttachedCommentText(node: ASTNode): string|undefined {
  // When the element is defined in a document fragment with a structure of
  // imports -> comment explaining the element -> then its dom-module, the
  // comment will be attached to <head>, rather than being a sibling to the
  // <dom-module>, thus the need to walk up and previous so aggressively.
  const parentComments = dom5.nodeWalkAllPrior(node, dom5.isCommentNode);
  const comment = <string|undefined>(
      parentComments[0] ? parentComments[0]['data'] : undefined);
  if (!comment || /@license/.test(comment)) {
    return;
  }
  return jsdoc.unindent(comment).trim();
}

function isLocationInfo(loc: (parse5.LocationInfo|parse5.ElementLocationInfo)):
    loc is parse5.LocationInfo {
  return 'line' in loc;
}

export function getLocationOffsetOfStartOfTextContent(node: ASTNode):
    LocationOffset {
  const childNodes = node.childNodes || [];
  let firstChildNodeWithLocation = childNodes.find(n => !!n.__location);
  let bestLocation = firstChildNodeWithLocation ?
      firstChildNodeWithLocation.__location :
      node.__location;
  if (!bestLocation) {
    throw new Error(
        `Couldn't extract a location offset from HTML node: ` +
        `${util.inspect(node)}`);
  }
  if (isLocationInfo(bestLocation)) {
    return {line: bestLocation.line - 1, col: bestLocation.col};
  } else {
    return {
      line: bestLocation.startTag.line - 1,
      col: bestLocation.startTag.endOffset,
    };
  }
}
