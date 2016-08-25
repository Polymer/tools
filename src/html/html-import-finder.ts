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

import {ScannedImport} from '../ast/ast';

import {HtmlVisitor, ParsedHtmlDocument} from './html-document';
import {HtmlEntityFinder} from './html-entity-finder';

const p = dom5.predicates;

const isHtmlImportNode = p.AND(p.hasTagName('link'), (node) => {
  const rel = dom5.getAttribute(node, 'rel') || '';
  return rel.split(' ').indexOf('import') !== -1;
}, p.NOT(p.hasAttrValue('type', 'css')));

export class HtmlImportFinder implements HtmlEntityFinder {
  async findEntities(
      document: ParsedHtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>):
      Promise<ScannedImport[]> {
    const imports: ScannedImport[] = [];

    await visit((node) => {
      if (isHtmlImportNode(node)) {
        const href = dom5.getAttribute(node, 'href');
        const importUrl = resolveUrl(document.url, href);
        imports.push(new ScannedImport(
            'html-import', importUrl, document.sourceRangeForNode(node)));
      }
    });
    return imports;
  }
}
