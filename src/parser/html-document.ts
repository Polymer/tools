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
import * as parse5 from 'parse5';
import {ASTNode} from 'parse5';

import {Analyzer} from '../analyzer';
import {Parser} from './parser';
import {ImportDescriptor} from '../ast/ast';

const p = dom5.predicates;

const isHtmlImportNode = p.AND(
  p.hasTagName('link'),
  p.hasAttrValue('rel', 'import'),
  p.NOT(
    p.hasAttrValue('type', 'css')
  )
);

const isStyleNode = p.OR(
  // inline style
  p.hasTagName('style'),
  // external stylesheet
  p.AND(
    p.hasTagName('link'),
    p.hasAttrValue('rel', 'stylesheet')
  ),
  // polymer specific external stylesheet
  p.AND(
    p.hasTagName('link'),
    p.hasAttrValue('rel', 'import'),
    p.hasAttrValue('type', 'css')
  )
);

const isJSScriptNode = p.AND(
  p.hasTagName('script'),
  p.OR(
    p.NOT(p.hasAttr('type')),
    p.hasAttrValue('type', 'text/javascript'),
    p.hasAttrValue('type', 'application/javascript')
  )
);
/**
 * The ASTs of the HTML elements needed to represent Polymer elements.
 */
export class HtmlDocument {
  /** The normalized URL of the document */
  url: string;

  /** The unparsed source of the document */
  contents: string;

  /** The parse5 ast for the document */
  ast: parse5.ASTNode;

  /** imports contained in this document */
  imports: ImportDescriptor[];

  base: parse5.ASTNode[] = [];
  /**
   * The entry points to the AST at each outermost template tag.
   */
  template: parse5.ASTNode[] = [];
  /**
   * The entry points to the AST at each script tag not inside a template.
   */
  script: parse5.ASTNode[] = [];
  /**
   * The entry points to the AST at style tag outside a template.
   */
  style: parse5.ASTNode[] = [];
  import: parse5.ASTNode[] = [];
  /**
   * The entry points to the AST at each outermost dom-module element.
   */
  domModule: parse5.ASTNode[] = [];
  comment: parse5.ASTNode[] = [];


  constructor(
      url: string,
      contents: string,
      document: parse5.ASTNode,
      imports: ImportDescriptor[]) {
    this.url = url;
    this.contents = contents;
    this.ast = document;
    this.imports = imports;
    // TODO(justinfagnani): remove this
    this._addNodes();
  }

  private _addNodes() {
    let queue = [].concat(this.ast.childNodes);
    let node: ASTNode;
    while (queue.length > 0) {
      node = queue.shift();
      if (node) {
        queue = queue.concat(node.childNodes);
        if (isHtmlImportNode(node)) {
          this.import.push(node);
        } else if (isStyleNode(node)) {
          this.style.push(node);
        } else if (isJSScriptNode(node)) {
          this.script.push(node);
        } else if (node['tagName'] === 'base') {
          this.base.push(node);
        } else if (node['tagName'] === 'template') {
          this.template.push(node);
        } else if (node['tagName'] === 'dom-module') {
          this.domModule.push(node);
        } else if (dom5.isCommentNode(node)) {
          this.comment.push(node);
        }
      }
    }

  }
}
