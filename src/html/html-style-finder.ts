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
import {ASTNode} from 'parse5';
import {resolve as resolveUrl} from 'url';

import {Descriptor, ImportDescriptor, InlineDocumentDescriptor} from '../ast/ast';

import {HtmlDocument, HtmlVisitor} from './html-document';
import {HtmlEntityFinder} from './html-entity-finder';

const p = dom5.predicates;

const isStyleElement = p.AND(
    p.hasTagName('style'),
    p.OR(p.NOT(p.hasAttr('type')), p.hasAttrValue('type', 'text/css')));

const isStyleLink = p.AND(p.hasTagName('link'), (node) => {
  let rel = dom5.getAttribute(node, 'rel') || '';
  return rel.split(' ').indexOf('stylesheet') !== -1;
});

const isStyleNode = p.OR(isStyleElement, isStyleLink);

export class HtmlStyleFinder implements HtmlEntityFinder {
  async findEntities(
      document: HtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>): Promise<Descriptor[]> {
    let entities:
        (ImportDescriptor<ASTNode>| InlineDocumentDescriptor<ASTNode>)[] = [];

    await visit(async(node) => {
      if (isStyleNode(node)) {
        let tagName = node.nodeName;
        if (tagName === 'link') {
          let href = dom5.getAttribute(node, 'href');
          let importUrl = resolveUrl(document.url, href);
          entities.push(
              new ImportDescriptor<ASTNode>('html-style', importUrl, node));
        } else {
          let contents = dom5.getTextContent(node);
          entities.push(new InlineDocumentDescriptor<ASTNode>(
              'css', contents, node, {line: 0, col: 0}));
        }
      }
    });

    return entities;
  }
}
