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

import {ScannedImport} from '../model/model';

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
    p.parentMatches(
        p.AND(p.hasTagName('dom-module'), p.NOT(p.hasTagName('template')))));

/**
 * Scans for <link rel="import"> and <link rel="lazy-import">
 */
export class HtmlImportScanner implements HtmlScanner {
  constructor(private _lazyEdges?: Map<string, string[]>) {
  }

  async scan(
      document: ParsedHtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>):
      Promise<ScannedImport[]> {
    const imports: ScannedImport[] = [];

    await visit((node) => {
      let type: string;
      if (isHtmlImportNode(node)) {
        type = 'html-import';
      } else if (isLazyImportNode(node)) {
        type = 'lazy-html-import';
      } else {
        return;
      }
      const href = dom5.getAttribute(node, 'href')!;
      const importUrl = resolveUrl(document.url, href);
      imports.push(new ScannedImport(
          type,
          importUrl,
          document.sourceRangeForNode(node)!,
          document.sourceRangeForAttributeValue(node, 'href')!,
          node));
    });
    if (this._lazyEdges) {
      const edges = this._lazyEdges.get(document.url);
      if (edges) {
        for (const edge of edges) {
          imports.push(new ScannedImport(
              'lazy-html-import', edge, undefined, undefined, null));
        }
      }
    }
    return imports;
  }
}
