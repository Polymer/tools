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

import {ImportDescriptor} from '../ast/ast';

import {HtmlDocument, HtmlVisitor} from './html-document';
import {HtmlEntityFinder} from './html-entity-finder';

const p = dom5.predicates;

const isHtmlImportNode = p.AND(p.hasTagName('link'), (node) => {
  let rel = dom5.getAttribute(node, 'rel') || '';
  return rel.split(' ').indexOf('import') !== -1;
}, p.NOT(p.hasAttrValue('type', 'css')));

export class HtmlImportFinder implements HtmlEntityFinder {
  async findEntities(
      document: HtmlDocument, visit: (visitor: HtmlVisitor) => Promise<void>):
      Promise<ImportDescriptor[]> {
    let imports: ImportDescriptor[] = [];
    await visit((node) => {
      if (isHtmlImportNode(node)) {
        let href = dom5.getAttribute(node, 'href');
        let importUrl = resolveUrl(document.url, href);
        imports.push(new ImportDescriptor('html-import', importUrl));
      }
    });
    return imports;
  }
}
