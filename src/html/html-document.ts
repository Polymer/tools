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

  // An element node with end tag information will produce a source range that
  // includes the closing tag.  It is assumed for offset calculation that the
  // closing tag is always of the expected `</${tagName}>` form.
  private _sourceRangeForElementWithEndTag(node: ASTNode): SourceRange
      |undefined {
    const location = node.__location;

    if (isElementLocationInfo(location)) {
      return {
        file: this.url,
        start: {
          line: location.startTag.line - 1,
          column: location.startTag.col - 1
        },
        end: {
          line: location.endTag.line - 1,
          column: location.endTag.col + (node.tagName || '').length + 2
        }
      };
    }
  }

  // parse5 locations are 1 based but ours are 0 based.
  protected _sourceRangeForNode(node: ASTNode): SourceRange|undefined {
    const location = node.__location;
    if (!node.__location) {
      return;
    }
    if (isElementLocationInfo(location)) {
      if (voidTagNames.has(node.tagName || '')) {
        return this.sourceRangeForStartTag(node);
      }
      return this._sourceRangeForElementWithEndTag(node);
    }

    return this._getSourceRangeForLocation(location);
  }

  sourceRangeForAttribute(node: ASTNode, attrName: string): SourceRange
      |undefined {
    return this._getSourceRangeForLocation(
        getAttributeLocation(node, attrName));
  }
  sourceRangeForAttributeName(node: ASTNode, attrName: string): SourceRange
      |undefined {
    const range = this.sourceRangeForAttribute(node, attrName);
    if (!range) {
      return;
    }
    // The attribute name can't have any spaces, newlines, or other funny
    // business in it, so this is pretty simple.
    return {
      file: range.file,
      start: range.start,
      end: {
        line: range.start.line,
        column: range.start.column + attrName.length
      }
    };
  }

  sourceRangeForAttributeValue(
      node: ASTNode, attrName: string, excludeQuotes?: boolean): SourceRange
      |undefined {
    const attributeRange = this.sourceRangeForAttribute(node, attrName);
    if (!attributeRange) {
      return;
    }
    // This is an attribute without a value.
    if ((attributeRange.start.line === attributeRange.end.line) &&
        (attributeRange.end.column - attributeRange.start.column ===
         attrName.length)) {
      return undefined;
    }
    const location = getAttributeLocation(node, attrName)!;
    // This is complex because there may be whitespace around the = sign.
    const fullAttribute =
        this.contents.substring(location.startOffset, location.endOffset);
    const equalsIndex = fullAttribute.indexOf('=');
    if (equalsIndex === -1) {
      // This is super weird and shouldn't happen, but it's probably better to
      // just return the most reasonable thing we have here rather than
      // throwing.
      return undefined;
    }
    const whitespaceAfterEquals =
        fullAttribute.substring(equalsIndex + 1).match(/[\s\n]*/)![0]!;
    let endOfTextToSkip =
        // the beginning of the attribute key value pair
        location.startOffset +
        // everything up to the equals sign
        equalsIndex +
        // plus one for the equals sign
        1 +
        // plus all the whitespace after the equals sign
        whitespaceAfterEquals.length;

    if (excludeQuotes) {
      const maybeQuote = this.contents.charAt(endOfTextToSkip);
      if (maybeQuote === '\'' || maybeQuote === '"') {
        endOfTextToSkip += 1;
      }
    }

    return this.offsetsToSourceRange(endOfTextToSkip, location.endOffset);
  }

  sourceRangeForStartTag(node: ASTNode): SourceRange|undefined {
    return this._getSourceRangeForLocation(getStartTagLocation(node));
  }

  sourceRangeForEndTag(node: ASTNode): SourceRange|undefined {
    return this._getSourceRangeForLocation(getEndTagLocation(node));
  }

  private _getSourceRangeForLocation(location: parse5.LocationInfo|
                                     undefined): SourceRange|undefined {
    if (!location) {
      return;
    }
    return this.offsetsToSourceRange(location.startOffset, location.endOffset);
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
    const selfClone = mutableDocuments.shift()!;

    for (const doc of mutableDocuments) {
      let expectedIndentation;
      if (doc.astNode.__location) {
        expectedIndentation = doc.astNode.__location.col;

        if (doc.astNode.parentNode && doc.astNode.parentNode.__location) {
          expectedIndentation -= doc.astNode.parentNode.__location.col;
        }
      } else {
        expectedIndentation = 2;
      }

      dom5.setTextContent(doc.astNode, '\n' + doc.stringify({
        indent: expectedIndentation
      }) + '  '.repeat(expectedIndentation - 1));
    }

    removeFakeNodes(selfClone.ast);
    return parse5.serialize(selfClone.ast);
  }
}

const injectedTagNames = new Set(['html', 'head', 'body']);
function removeFakeNodes(ast: dom5.Node) {
  const children = (ast.childNodes || []).slice();
  if (ast.parentNode && isFakeNode(ast)) {
    for (const child of children) {
      dom5.insertBefore(ast.parentNode, ast, child);
    }
    dom5.remove(ast);
  }
  for (const child of children) {
    removeFakeNodes(child);
  }
}

export function isFakeNode(ast: dom5.Node) {
  return !ast.__location && injectedTagNames.has(ast.nodeName);
}

function isElementLocationInfo(location: parse5.LocationInfo|
                               parse5.ElementLocationInfo):
    location is parse5.ElementLocationInfo {
  const loc = location as Partial<parse5.ElementLocationInfo>;
  return (loc.startTag && loc.endTag) != null;
}

function getStartTagLocation(node: parse5.ASTNode): parse5.LocationInfo|
    undefined {
  if (voidTagNames.has(node.tagName || '')) {
    return node.__location as parse5.LocationInfo;
  }
  if ('startTag' in node.__location) {
    return (node.__location as parse5.ElementLocationInfo).startTag;
  }
  // Sometimes parse5 throws an attrs attribute on a location info that seems
  // to correspond to an unclosed tag with attributes but no children.
  // In that case, the node's location corresponds to the start tag. In other
  // cases though, node.__location will include children.
  if ('attrs' in node.__location) {
    return node.__location as parse5.LocationInfo;
  }
}

function getEndTagLocation(node: parse5.ASTNode): parse5.LocationInfo|
    undefined {
  if ('endTag' in node.__location) {
    return (node.__location as parse5.ElementLocationInfo).endTag;
  }
}

function getAttributeLocation(
    node: parse5.ASTNode, attrName: string): parse5.LocationInfo|undefined {
  if (!node || !node.__location) {
    return;
  }
  let attrs: parse5.AttributesLocationInfo|undefined = undefined;
  const location = node.__location;
  const elemLocation = location as Partial<parse5.ElementLocationInfo>;
  const elemStartLocation = location as Partial<parse5.StartTagLocationInfo>;
  if (elemLocation.startTag !== undefined && elemLocation.startTag.attrs) {
    attrs = elemLocation.startTag.attrs;
  } else if (elemStartLocation.attrs !== undefined) {
    attrs = elemStartLocation.attrs;
  }
  if (!attrs) {
    return;
  }
  return attrs[attrName];
}

/**
 * HTML5 treats these tags as *always* self-closing. This is relevant for
 * getting start tag information.
 *
 * Source: https://www.w3.org/TR/html5/syntax.html#void-elements
 */
const voidTagNames = new Set([
  'area',
  'base',
  'br',
  'col',
  'embed',
  'hr',
  'img',
  'input',
  'keygen',
  'link',
  'meta',
  'param',
  'source',
  'track',
  'wbr'
]);
