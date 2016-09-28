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

import {SourceRange} from '../model/model';
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

  stringify() {
    // TODO(issues/315): serialize inline documents correctly.
    let result = parse5.serialize(this.ast);

    // Strip out inferred boilerplate nodes that are injected.
    const injectedTagNames = ['html', 'head', 'body'];
    for (const tagName of injectedTagNames) {
      if (!this.contents.includes(`<${tagName}`)) {
        result =
            result.replace(RegExp(`<${tagName}>([^]*)?</${tagName}>`), '$1');
      }
    }

    return result;
  }
}

function isElementLocationInfo(location: parse5.LocationInfo|
                               parse5.ElementLocationInfo):
    location is parse5.ElementLocationInfo {
  return location['startTag'] && location['endTag'];
}
