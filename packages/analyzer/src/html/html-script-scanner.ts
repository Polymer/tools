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

import * as dom5 from 'dom5/lib/index-next';

import {getAttachedCommentText, getLocationOffsetOfStartOfTextContent, ScannedImport, ScannedInlineDocument} from '../model/model';
import {FileRelativeUrl} from '../model/url';

import {HtmlVisitor, ParsedHtmlDocument} from './html-document';
import {HtmlScanner} from './html-scanner';
import {ScannedScriptTagImport} from './html-script-tag';

const p = dom5.predicates;

const isJsScriptNode = p.AND(
    p.hasTagName('script'),
    p.OR(
        p.NOT(p.hasAttr('type')),
        p.hasAttrValue('type', 'text/javascript'),
        p.hasAttrValue('type', 'application/javascript'),
        p.hasAttrValue('type', 'module')));

export class HtmlScriptScanner implements HtmlScanner {
  async scan(
      document: ParsedHtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>) {
    const features: (ScannedImport|ScannedInlineDocument)[] = [];

    const myVisitor: HtmlVisitor = (node) => {
      if (isJsScriptNode(node)) {
        const src =
            dom5.getAttribute(node, 'src') as FileRelativeUrl | undefined;
        if (src) {
          features.push(new ScannedScriptTagImport(
              'html-script',
              src,
              document.sourceRangeForNode(node)!,
              document.sourceRangeForAttributeValue(node, 'src')!,
              {language: 'html', node, containingDocument: document},
              false));
        } else {
          const locationOffset =
              getLocationOffsetOfStartOfTextContent(node, document);
          const attachedCommentText = getAttachedCommentText(node) || '';
          const contents = dom5.getTextContent(node);

          features.push(new ScannedInlineDocument(
              'js',
              contents,
              locationOffset,
              attachedCommentText,
              document.sourceRangeForNode(node)!,
              {language: 'html', node, containingDocument: document}));
        }
      }
    };

    await visit(myVisitor);

    return {features};
  }
}
