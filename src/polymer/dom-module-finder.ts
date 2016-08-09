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

import {ScannedFeature, getAttachedCommentText} from '../ast/ast';

import {ParsedHtmlDocument, HtmlVisitor} from '../html/html-document';
import {HtmlEntityFinder} from '../html/html-entity-finder';

const p = dom5.predicates;

const isDomModule = p.hasTagName('dom-module');

export class DomModuleDescriptor implements ScannedFeature {
  id?: string;
  node: ASTNode;
  comment?: string;

  constructor(id: string, node: ASTNode) {
    this.id = id;
    this.node = node;
    this.comment = getAttachedCommentText(node);
    console.log(`found dom module ${id} with comment: ${this.comment}`);
  }
}

export class DomModuleFinder implements HtmlEntityFinder {
  async findEntities(
      document: ParsedHtmlDocument, visit: (visitor: HtmlVisitor) => Promise<void>):
      Promise<DomModuleDescriptor[]> {
    let domModules: DomModuleDescriptor[] = [];

    await visit((node) => {
      if (isDomModule(node)) {
        domModules.push(
            new DomModuleDescriptor(dom5.getAttribute(node, 'id'), node));
      }
    });
    return domModules;
  }
}
