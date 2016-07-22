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

import {Analyzer} from '../analyzer';
import {Descriptor, DocumentDescriptor, ImportDescriptor} from '../ast/ast';
import {HtmlDocument, HtmlVisitor} from './html-document';
import {HtmlEntityFinder} from './html-entity-finder';

const p = dom5.predicates;

const isJsScriptNode = p.AND(
  p.hasTagName('script'),
  p.OR(
    p.NOT(p.hasAttr('type')),
    p.hasAttrValue('type', 'text/javascript'),
    p.hasAttrValue('type', 'application/javascript'),
    p.hasAttrValue('type', 'module')
  )
);

export class HtmlScriptFinder implements HtmlEntityFinder {

  analyzer: Analyzer;

  constructor(analyzer: Analyzer) {
    this.analyzer = analyzer;
  }

  async findEntities(
      document: HtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>): Promise<Descriptor[]> {
    let promises: Promise<ImportDescriptor | DocumentDescriptor>[] = [];
    await visit((node) => {
      if (isJsScriptNode(node)) {
        let src = dom5.getAttribute(node, 'src');
        if (src) {
          let importUrl = resolveUrl(document.url, src);
          promises.push(
              Promise.resolve(new ImportDescriptor('html-script', importUrl)));
        } else {
          let contents = dom5.getTextContent(node);
          promises.push(
              this.analyzer.analyzeSource('js', contents, document.url));
        }
      }
    });
    let entities = await Promise.all(promises);
    return entities;
  }

}
