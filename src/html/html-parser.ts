/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import {parse as parseHtml} from 'parse5';

import {InlineDocInfo} from '../model/model';
import {Parser} from '../parser/parser';

import {ParsedHtmlDocument} from './html-document';

export class HtmlParser implements Parser<ParsedHtmlDocument> {
  /**
  * Parse html into ASTs.
  *
  * @param {string} htmlString an HTML document.
  * @param {string} href is the path of the document.
  */
  parse(contents: string, url: string, inlineInfo?: InlineDocInfo<any>):
      ParsedHtmlDocument {
    let ast = parseHtml(contents, {locationInfo: true});
    const isInline = !!inlineInfo;
    inlineInfo = inlineInfo || {};
    return new ParsedHtmlDocument({
      url,
      contents,
      ast,
      locationOffset: inlineInfo.locationOffset,
      astNode: inlineInfo.astNode, isInline,
    });
  }
}
