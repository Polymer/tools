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

import {Feature, Resolvable, ScannedFeature, SourceRange, getAttachedCommentText} from '../model/model';
import {HtmlVisitor, ParsedHtmlDocument} from '../html/html-document';
import {HtmlScanner} from '../html/html-scanner';

const p = dom5.predicates;

const isDomModule = p.hasTagName('dom-module');

export class ScannedDomModule implements ScannedFeature, Resolvable {
  id?: string;
  node: ASTNode;
  comment?: string;
  sourceRange: SourceRange;

  constructor(id: string, node: ASTNode, sourceRange: SourceRange) {
    this.id = id;
    this.node = node;
    this.comment = getAttachedCommentText(node);
    this.sourceRange = sourceRange;
  }

  resolve() {
    return new DomModule(this.node, this.id, this.comment, this.sourceRange);
  }
}

export class DomModule implements Feature {
  kinds = new Set(['dom-module']);
  identifiers = new Set<string>();
  node: ASTNode;
  id: string|undefined;
  comment: string|undefined;
  sourceRange: SourceRange;
  constructor(
      node: ASTNode, id: string, comment: string, sourceRange: SourceRange) {
    this.node = node;
    this.id = id;
    this.comment = comment;
    if (this.id) {
      this.identifiers.add(id);
    }
    this.sourceRange = sourceRange;
  }
}

export class DomModuleScanner implements HtmlScanner {
  async scan(
      document: ParsedHtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>):
      Promise<ScannedDomModule[]> {
    let domModules: ScannedDomModule[] = [];

    await visit((node) => {
      if (isDomModule(node)) {
        domModules.push(new ScannedDomModule(
            dom5.getAttribute(node, 'id'), node,
            document.sourceRangeForNode(node)));
      }
    });
    return domModules;
  }
}
