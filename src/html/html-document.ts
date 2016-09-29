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

import * as clone from 'clone';
import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import {ASTNode} from 'parse5';

import {SourceRange} from '../model/model';
import {Options, ParsedDocument, StringifyOptions} from '../parser/document';

/**
 * The ASTs of the HTML elements needed to represent Polymer elements.
 */

export interface HtmlVisitor { (node: ASTNode): void; }

export class ParsedHtmlDocument extends ParsedDocument<ASTNode, HtmlVisitor> {
  type = 'html';

  constructor(from: Options<ASTNode>) {
    super(from);
  }

  visit(visitors: HtmlVisitor[]) {
    dom5.nodeWalk(this.ast, (node) => {
      visitors.forEach((visitor) => visitor(node));
      return false;
    });
  }

  forEachNode(callback: (node: ASTNode) => void) {
    dom5.nodeWalk(this.ast, (node) => {
      callback(node);
      return false;
    });
  }

  _sourceRangeForNode(node: ASTNode): SourceRange {
    if (!node || !node.__location) {
      return;
    }
    // dom5 locations are 1 based but ours are 0 based.
    const location = node.__location;
    if (isElementLocationInfo(location)) {
      return {
        file: this.url,
        start: {
          line: location.startTag.line - 1,
          column: location.startTag.col - 1
        },
        end: {line: location.endTag.line - 1, column: location.endTag.col - 1}
      };
    }
    return {
      file: this.url,
      // one indexed to zero indexed
      start: {line: location.line - 1, column: location.col - 1},
      end: {
        line: location.line - 1,
        column: location.col + (location.endOffset - location.startOffset) - 1
      }
    };
  }

  sourceRangeForAttribute(node: ASTNode, attrName: string): SourceRange
      |undefined {
    if (!node || !node.__location) {
      return;
    }
    let attrs: parse5.AttributesLocationInfo;
    if (node.__location['startTag'] && node.__location['startTag'].attrs) {
      attrs = node.__location['startTag'].attrs;
    } else if (node.__location['attrs']) {
      attrs = node.__location['attrs'];
    }
    if (!attrs) {
      return;
    }
    const attrLocation = attrs[attrName];
    if (!attrLocation) {
      return;
    }
    return {
      file: this.url,
      start: {line: attrLocation.line - 1, column: attrLocation.col - 1},
      end: {
        line: attrLocation.line - 1,
        column: attrLocation.col +
            (attrLocation.endOffset - attrLocation.startOffset) - 1
      }
    };
  }

  stringify(options?: StringifyOptions) {
    options = options || {};
    /**
     * We want to mutate this.ast with the results of stringifying our inline
     * documents. This will mutate this.ast even if no one else has mutated it
     * yet, because our inline documents' stringifiers may not perfectly
     * reproduce their input. However, we don't want to mutate any analyzer
     * object after they've been produced and cached, ParsedHtmlDocuments
     * included. So we want to clone first.
     *
     * Because our inline documents contain references into this.ast, we need to
     * make of copy of `this` and the inline documents such the
     * inlineDoc.astNode references into this.ast are maintained. Fortunately,
     * clone() does this! So we'll clone them all together in a single call by
     * putting them all into an array.
     */
    const immutableDocuments = options.inlineDocuments || [];
    immutableDocuments.unshift(this);

    // We can modify these, as they don't escape this method.
    const mutableDocuments = clone(immutableDocuments);
    const selfClone = mutableDocuments.shift();

    for (const doc of mutableDocuments) {
      // TODO(rictic): infer this from doc.astNode's indentation.
      const expectedIndentation = 2;

      dom5.setTextContent(
          doc.astNode, '\n' + doc.stringify({indent: expectedIndentation}) +
              '  '.repeat(expectedIndentation - 1));
    }

    removeFakeNodes(selfClone.ast);
    return parse5.serialize(selfClone.ast);
  }
}

const injectedTagNames = new Set(['html', 'head', 'body']);
function removeFakeNodes(ast: dom5.Node) {
  const children = (ast.childNodes || []).slice();
  if (ast.parentNode && !ast.__location && injectedTagNames.has(ast.nodeName)) {
    for (const child of children) {
      dom5.insertBefore(ast.parentNode, ast, child);
    }
    dom5.remove(ast);
  }
  for (const child of children) {
    removeFakeNodes(child);
  }
}

function isElementLocationInfo(location: parse5.LocationInfo|
                               parse5.ElementLocationInfo):
    location is parse5.ElementLocationInfo {
  return location['startTag'] && location['endTag'];
}
