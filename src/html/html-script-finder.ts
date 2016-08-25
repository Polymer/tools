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

const isJsScriptNode = p.AND(
    p.hasTagName('script'),
    p.OR(
        p.NOT(p.hasAttr('type')), p.hasAttrValue('type', 'text/javascript'),
        p.hasAttrValue('type', 'application/javascript'),
        p.hasAttrValue('type', 'module')));

export class HtmlScriptFinder implements HtmlEntityFinder {
  async findEntities(
      document: ParsedHtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>):
      Promise<ScannedFeature[]> {
    const entities: (ScannedImport | InlineParsedDocument)[] = [];

    const myVisitor: HtmlVisitor = (node) => {
      if (isJsScriptNode(node)) {
        const src = dom5.getAttribute(node, 'src');
        if (src) {
          const importUrl = resolveUrl(document.url, src);
          entities.push(new ScannedImport(
              'html-script', importUrl, document.sourceRangeForNode(node)));
        } else {
          const locationOffset = getLocationOffsetOfStartOfTextContent(node);
          const attachedCommentText = getAttachedCommentText(node);
          const contents = dom5.getTextContent(node);

          entities.push(new InlineParsedDocument(
              'js', contents, locationOffset, attachedCommentText,
              document.sourceRangeForNode(node)));
        }
      }
    };

    await visit(myVisitor);

    return entities;
  }
}
