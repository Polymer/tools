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
import {ASTNode, treeAdapters} from 'parse5';

import {getAttachedCommentText, getLocationOffsetOfStartOfTextContent, ScannedImport, ScannedInlineDocument} from '../model/model';
import {FileRelativeUrl} from '../model/url';

import {HtmlVisitor, ParsedHtmlDocument} from './html-document';
import {HtmlScanner} from './html-scanner';

const p = dom5.predicates;

const isStyleElement = p.AND(
    p.hasTagName('style'),
    p.OR(p.NOT(p.hasAttr('type')), p.hasAttrValue('type', 'text/css')));

const isStyleLink = p.AND(
    p.hasTagName('link'),
    p.hasSpaceSeparatedAttrValue('rel', 'stylesheet'),
    p.hasAttr('href'));

const isStyleNode = p.OR(isStyleElement, isStyleLink);

export class HtmlStyleScanner implements HtmlScanner {
  async scan(
      document: ParsedHtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>) {
    const features: (ScannedImport|ScannedInlineDocument)[] = [];

    const visitor = async (node: ASTNode) => {
      if (isStyleNode(node)) {
        const tagName = node.nodeName;
        if (tagName === 'link') {
          const href = dom5.getAttribute(node, 'href')! as FileRelativeUrl;
          features.push(new ScannedImport(
              'html-style',
              ScannedImport.resolveUrl(document.baseUrl, href),
              document.sourceRangeForNode(node)!,
              document.sourceRangeForAttributeValue(node, 'href')!,
              node,
              true));
        } else {
          const contents = dom5.getTextContent(node);
          const locationOffset = getLocationOffsetOfStartOfTextContent(node);
          const commentText = getAttachedCommentText(node) || '';
          features.push(new ScannedInlineDocument(
              'css',
              contents,
              locationOffset,
              commentText,
              document.sourceRangeForNode(node)!,
              node));
        }
      }
      // Descend into templates.
      if (node.tagName === 'template') {
        const content = treeAdapters.default.getTemplateContent(node);
        if (content) {
          dom5.nodeWalk(content, (n) => {
            visitor(n);
            return false;
          });
        }
      }
    };

    await visit(visitor);

    return {features};
  }
}
