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

import {HtmlVisitor, ParsedHtmlDocument} from '../html/html-document';
import {HtmlScanner} from '../html/html-scanner';
import {Feature, getAttachedCommentText, Resolvable, SourceRange} from '../model/model';
import {Warning} from '../warning/warning';

const p = dom5.predicates;

const isDomModule = p.hasTagName('dom-module');

export class ScannedDomModule implements Resolvable {
  id: string|null;
  node: ASTNode;
  comment?: string;
  sourceRange: SourceRange;
  astNode: dom5.Node;
  warnings: Warning[] = [];

  constructor(
      id: string|null, node: ASTNode, sourceRange: SourceRange,
      ast: dom5.Node) {
    this.id = id;
    this.node = node;
    this.comment = getAttachedCommentText(node);
    this.sourceRange = sourceRange;
    this.astNode = ast;
  }

  resolve() {
    return new DomModule(
        this.node,
        this.id,
        this.comment,
        this.sourceRange,
        this.astNode,
        this.warnings);
  }
}

export class DomModule implements Feature {
  kinds = new Set(['dom-module']);
  identifiers = new Set<string>();
  node: ASTNode;
  id: string|null;
  comment?: string;
  sourceRange: SourceRange;
  astNode: dom5.Node;
  warnings: Warning[];

  constructor(
      node: ASTNode, id: string|null, comment: string|undefined,
      sourceRange: SourceRange, ast: dom5.Node, warnings: Warning[]) {
    this.node = node;
    this.id = id;
    this.comment = comment;
    if (id) {
      this.identifiers.add(id);
    }
    this.sourceRange = sourceRange;
    this.astNode = ast;
    this.warnings = warnings;
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
            dom5.getAttribute(node, 'id'),
            node,
            document.sourceRangeForNode(node)!,
            node));
      }
    });
    return domModules;
  }
}
