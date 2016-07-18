/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at http://polymer.github.io/LICENSE.txt
 * The complete set of authors may be found at http://polymer.github.io/AUTHORS.txt
 * The complete set of contributors may be found at http://polymer.github.io/CONTRIBUTORS.txt
 * Code distributed by Google as part of the polymer project is also
 * subject to an additional IP rights grant found at http://polymer.github.io/PATENTS.txt
 */

import * as dom5 from 'dom5';
import * as parse5 from 'parse5';
import {ASTNode} from 'parse5';

import {Analyzer} from '../analyzer';
import {Parser} from './parser';
import {ImportDescriptor} from '../ast/ast';

import {HtmlDocument} from './html-document';

export function getOwnerDocument(node: parse5.ASTNode): parse5.ASTNode {
  while (node && !dom5.isDocument(node)) {
    node = node.parentNode;
  }
  return node;
}

export class HtmlParser implements Parser<HtmlDocument> {

  analyzer: Analyzer;

  constructor(analyzer: Analyzer) {
    this.analyzer = analyzer;
  }

  /**
  * Parse html into ASTs.
  *
  * @param {string} htmlString an HTML document.
  * @param {string} href is the path of the document.
  */
  parse(contents: string, url: string): HtmlDocument {
    let ast = parse5.parse(contents, {locationInfo: true});
    let imports = this.analyzer.findImports(url, ast);
    return new HtmlDocument({url, contents, ast, imports, analyzer: this.analyzer});
  }

}
