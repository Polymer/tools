/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as dom5 from 'dom5';
import {ASTNode} from 'parse5';
import {resolve as resolveUrl} from 'url';

import {ImportFinder} from './import-finder.ts';
import {ImportDescriptor} from '../ast/ast';

const p = dom5.predicates;

const isHtmlImportNode = p.AND(
  p.hasTagName('link'),
  (node) => {
    let rel = dom5.getAttribute(node, 'rel') || '';
    return rel.split(' ').indexOf('import') !== -1;
  },
  p.NOT(
    p.hasAttrValue('type', 'css')
  )
);

export class HtmlImportFinder implements ImportFinder<ASTNode> {

  findImports(url: string, document: ASTNode): ImportDescriptor[] {
    let importLinks = dom5.queryAll(document, isHtmlImportNode);
    let importDescriptors = importLinks.map((link) => {
      let href = dom5.getAttribute(link, 'href');
      let importUrl = resolveUrl(url, href);
      return new ImportDescriptor('html', importUrl);
    });
    return importDescriptors;
  }

}
