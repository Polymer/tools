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
import {Feature, getAttachedCommentText, Resolvable, Slot, SourceRange, Warning} from '../model/model';

import {HtmlDatabindingExpression, scanDatabindingTemplateForExpressions, Template} from './expression-scanner';
import {LocalId} from './polymer-element';

const p = dom5.predicates;

const isDomModule = p.hasTagName('dom-module');

export class ScannedDomModule implements Resolvable {
  id: string|null;
  node: ASTNode;
  comment?: string;
  sourceRange: SourceRange;
  astNode: dom5.Node;
  warnings: Warning[] = [];
  'slots': Slot[];
  localIds: LocalId[];
  template: Template|undefined;
  databindings: HtmlDatabindingExpression[];

  constructor(
      id: string|null, node: ASTNode, sourceRange: SourceRange, ast: dom5.Node,
      warnings: Warning[], template: Template|undefined, slots: Slot[],
      localIds: LocalId[], databindings: HtmlDatabindingExpression[]) {
    this.id = id;
    this.node = node;
    this.comment = getAttachedCommentText(node);
    this.sourceRange = sourceRange;
    this.astNode = ast;
    this.slots = slots;
    this.localIds = localIds;
    this.warnings = warnings;
    this.template = template;
    this.databindings = databindings;
  }

  resolve() {
    return new DomModule(
        this.node,
        this.id,
        this.comment,
        this.sourceRange,
        this.astNode,
        this.warnings,
        this.slots,
        this.localIds,
        this.template,
        this.databindings);
  }
}

declare module '../model/queryable' {
  interface FeatureKindMap {
    'dom-module': DomModule;
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
  'slots': Slot[];
  localIds: LocalId[];
  template: Template|undefined;
  databindings: HtmlDatabindingExpression[];

  constructor(
      node: ASTNode, id: string|null, comment: string|undefined,
      sourceRange: SourceRange, ast: dom5.Node, warnings: Warning[],
      slots: Slot[], localIds: LocalId[], template: Template|undefined,
      databindings: HtmlDatabindingExpression[]) {
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
    this.localIds = localIds;
    this.template = template;
    this.databindings = databindings;
  }
}

export class DomModuleScanner implements HtmlScanner {
  async scan(
      document: ParsedHtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>) {
    const domModules: ScannedDomModule[] = [];

    await visit((node) => {
      if (isDomModule(node)) {
        const children = dom5.defaultChildNodes(node) || [];
        const template =
            children.find(dom5.predicates.hasTagName('template')) as
            (Template | undefined);
        let slots: Slot[] = [];
        let localIds: LocalId[] = [];
        let databindings: HtmlDatabindingExpression[] = [];
        let warnings: Warning[] = [];
        if (template) {
          const templateContent =
              treeAdapters.default.getTemplateContent(template);
          slots =
              dom5.queryAll(templateContent, dom5.predicates.hasTagName('slot'))
                  .map(
                      (s) => new Slot(
                          dom5.getAttribute(s, 'name') || '',
                          document.sourceRangeForNode(s)!,
                          s));
          localIds =
              dom5.queryAll(templateContent, dom5.predicates.hasAttr('id'))
                  .map(
                      (e) => new LocalId(
                          dom5.getAttribute(e, 'id')!,
                          document.sourceRangeForNode(e)!));
          const results =
              scanDatabindingTemplateForExpressions(document, template);
          warnings = results.warnings;
          databindings = results.expressions;
        }
        domModules.push(new ScannedDomModule(
            dom5.getAttribute(node, 'id'),
            node,
            document.sourceRangeForNode(node)!,
            node,
            warnings,
            template,
            slots,
            localIds,
            databindings));
      }
    });
    return {features: domModules};
  }
}
