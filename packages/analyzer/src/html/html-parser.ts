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

import {getAttribute, predicates as p} from 'dom5';
import * as dom5 from 'dom5/lib/index-next';
import {parse as parseHtml} from 'parse5';

import {InlineDocInfo} from '../model/model';
import {FileRelativeUrl, ResolvedUrl} from '../model/url';
import {Parser} from '../parser/parser';
import {UrlResolver} from '../url-loader/url-resolver';

import {ParsedHtmlDocument} from './html-document';

export class HtmlParser implements Parser<ParsedHtmlDocument> {
  /**
   * Parse html into ASTs.
   *
   * @param {string} htmlString an HTML document.
   * @param {string} href is the path of the document.
   */
  parse(
      contents: string, url: ResolvedUrl, urlResolver: UrlResolver,
      inlineInfo?: InlineDocInfo): ParsedHtmlDocument {
    const ast = parseHtml(contents, {locationInfo: true});

    // There should be at most one <base> tag and it must be inside <head> tag.
    const baseTag = dom5.query(
        ast,
        p.AND(
            p.parentMatches(p.hasTagName('head')),
            p.hasTagName('base'),
            p.hasAttr('href')));

    const isInline = !!inlineInfo;
    inlineInfo = inlineInfo || {};

    let baseUrl: ResolvedUrl =
        inlineInfo.baseUrl !== undefined ? inlineInfo.baseUrl : url;
    if (baseTag) {
      const baseTagHref = getAttribute(baseTag, 'href')! as FileRelativeUrl;
      const resolvedBaseTagHref =
          urlResolver.resolve(url, baseTagHref, undefined);
      if (resolvedBaseTagHref !== undefined) {
        baseUrl = resolvedBaseTagHref;
      }
    }

    return new ParsedHtmlDocument({
      url,
      baseUrl,
      contents,
      ast,
      locationOffset: inlineInfo.locationOffset,
      astNode: inlineInfo.astNode,
      isInline,
    });
  }
}
