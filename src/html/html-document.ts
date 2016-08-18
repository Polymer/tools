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

import {SourceRange} from '../ast/ast';
import {Options, ParsedDocument} from '../parser/document';

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

  sourceRangeForNode(node: ASTNode): SourceRange {
    if (!node || !node.__location) {
      return;
    }
    // dom5 locations are 1 based but ours are 0 based.
    const location = node.__location;
    if (isElementLocationInfo(location)) {
      return {
        file: this.url,
        start:
            {line: location.startTag.line - 1, column: location.startTag.col},
        end: {line: location.endTag.line - 1, column: location.endTag.col}
      };
    }
    return {
      file: this.url,
      // one indexed to zero indexed
      start: {line: location.line - 1, column: location.col},
      end: {
        line: location.line - 1,
        column: location.col + (location.endOffset - location.startOffset)
      }
    };
  }
}

function isElementLocationInfo(location: parse5.LocationInfo|
                               parse5.ElementLocationInfo):
    location is parse5.ElementLocationInfo {
  return location['startTag'] && location['endTag'];
}
