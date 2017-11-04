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

import {ScannedImport} from '../model/model';
import {FileRelativeUrl, PackageRelativeUrl, ResolvedUrl} from '../model/url';

import {HtmlVisitor, ParsedHtmlDocument} from './html-document';
import {HtmlScanner} from './html-scanner';

const p = dom5.predicates;

const linkTag = p.hasTagName('link');
const notCssLink = p.NOT(p.hasAttrValue('type', 'css'));

const isHtmlImportNode = p.AND(
    linkTag,
    p.hasAttr('href'),
    p.hasSpaceSeparatedAttrValue('rel', 'import'),
    p.NOT(p.hasSpaceSeparatedAttrValue('rel', 'lazy-import')),
    notCssLink,
    p.NOT(p.parentMatches(p.hasTagName('template'))));

const isLazyImportNode = p.AND(
    p.hasTagName('link'),
    p.hasSpaceSeparatedAttrValue('rel', 'lazy-import'),
    p.hasAttr('href'),
    p.NOT(p.hasSpaceSeparatedAttrValue('rel', 'import')),
    notCssLink,
    p.NOT(p.parentMatches(p.hasTagName('template'))));

/**
 * Scans for <link rel="import"> and <link rel="lazy-import">
 */
export class HtmlImportScanner implements HtmlScanner {
  constructor(private _lazyEdges?: Map<ResolvedUrl, PackageRelativeUrl[]>) {
  }

  async scan(
      document: ParsedHtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>) {
    const imports: ScannedImport[] = [];

    const type = 'html-import';
    await visit((node) => {
      let lazy: boolean;
      if (isHtmlImportNode(node)) {
        lazy = false;
      } else if (isLazyImportNode(node)) {
        lazy = true;
      } else {
        return;
      }
      const href = dom5.getAttribute(node, 'href')! as FileRelativeUrl;
      imports.push(new ScannedImport(
          type,
          ScannedImport.resolveUrl(document.baseUrl, href),
          document.sourceRangeForNode(node)!,
          document.sourceRangeForAttributeValue(node, 'href')!,
          node,
          lazy));
    });
    if (this._lazyEdges) {
      const edges = this._lazyEdges.get(document.url);
      if (edges) {
        for (const edge of edges) {
          imports.push(
              new ScannedImport(type, edge, undefined, undefined, null, true));
        }
      }
    }
    return {features: imports};
  }
}
