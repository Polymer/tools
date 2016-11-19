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
import {ASTNode, treeAdapters} from 'parse5';

import {HtmlVisitor, ParsedHtmlDocument} from '../html/html-document';
import {HtmlScanner} from '../html/html-scanner';
import {Feature, getAttachedCommentText, Resolvable, SourceRange, Slot} from '../model/model';
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
  slots: Slot[];

  constructor(
      id: string|null, node: ASTNode, sourceRange: SourceRange,
      ast: dom5.Node, slots: Slot[]) {
    this.id = id;
    this.node = node;
    this.comment = getAttachedCommentText(node);
    this.sourceRange = sourceRange;
    this.astNode = ast;
    this.slots = slots;
  }

  resolve() {
    return new DomModule(
        this.node,
        this.id,
        this.comment,
        this.sourceRange,
        this.astNode,
        this.warnings,
        this.slots);
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
  slots: Slot[];

  constructor(
      node: ASTNode, id: string|null, comment: string|undefined,
      sourceRange: SourceRange, ast: dom5.Node, warnings: Warning[],
      slots: Slot[]) {
    this.node = node;
    this.id = id;
    this.comment = comment;
    if (id) {
      this.identifiers.add(id);
    }
    this.sourceRange = sourceRange;
    this.astNode = ast;
    this.warnings = warnings;
    this.slots = slots;
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
        const template = dom5.query(node, dom5.predicates.hasTagName('template'));
        let slots: Slot[] = [];
        if (template) {
          slots = dom5.queryAll(
            treeAdapters.default.getTemplateContent(template),
            dom5.predicates.hasTagName('slot')
          ).map(s => new Slot(dom5.getAttribute(s, 'name') || '', document.sourceRangeForNode(s)!));
        }
        domModules.push(new ScannedDomModule(
            dom5.getAttribute(node, 'id'),
            node,
            document.sourceRangeForNode(node)!,
            node,
            slots));
      }
    });
    return domModules;
  }
}
