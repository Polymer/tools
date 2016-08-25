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
import {resolve as resolveUrl} from 'url';

import {InlineParsedDocument, ScannedFeature, ScannedImport, getAttachedCommentText, getLocationOffsetOfStartOfTextContent} from '../ast/ast';

import {HtmlVisitor, ParsedHtmlDocument} from './html-document';
import {HtmlEntityFinder} from './html-entity-finder';

const p = dom5.predicates;

const isStyleElement = p.AND(
    p.hasTagName('style'),
    p.OR(p.NOT(p.hasAttr('type')), p.hasAttrValue('type', 'text/css')));

const isStyleLink = p.AND(p.hasTagName('link'), (node) => {
  const rel = dom5.getAttribute(node, 'rel') || '';
  return rel.split(' ').indexOf('stylesheet') !== -1;
});

const isStyleNode = p.OR(isStyleElement, isStyleLink);

export class HtmlStyleFinder implements HtmlEntityFinder {
  async findEntities(
      document: ParsedHtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>):
      Promise<ScannedFeature[]> {
    const entities: (ScannedImport | InlineParsedDocument)[] = [];

    await visit(async(node) => {
      if (isStyleNode(node)) {
        const tagName = node.nodeName;
        if (tagName === 'link') {
          const href = dom5.getAttribute(node, 'href');
          const importUrl = resolveUrl(document.url, href);
          entities.push(new ScannedImport(
              'html-style', importUrl, document.sourceRangeForNode(node)));
        } else {
          const contents = dom5.getTextContent(node);
          const locationOffset = getLocationOffsetOfStartOfTextContent(node);
          const commentText = getAttachedCommentText(node);
          entities.push(new InlineParsedDocument(
              'css', contents, locationOffset, commentText,
              document.sourceRangeForNode(node)));
        }
      }
    });

    return entities;
  }
}
