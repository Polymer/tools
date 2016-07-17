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

import {Parser} from './parser';

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

function addNode(node: ASTNode, registry: ParsedImport) {
  if (isHtmlImportNode(node)) {
    registry.import.push(node);
  } else if (isStyleNode(node)) {
    registry.style.push(node);
  } else if (isJSScriptNode(node)) {
    registry.script.push(node);
  } else if (node['tagName'] === 'base') {
    registry.base.push(node);
  } else if (node['tagName'] === 'template') {
    registry.template.push(node);
  } else if (node['tagName'] === 'dom-module') {
    registry['dom-module'].push(node);
  } else if (dom5.isCommentNode(node)) {
    registry.comment.push(node);
  }
}

/**
 * The ASTs of the HTML elements needed to represent Polymer elements.
 */
export interface ParsedImport {
  base: parse5.ASTNode[];
  /**
   * The entry points to the AST at each outermost template tag.
   */
  template: parse5.ASTNode[];
  /**
   * The entry points to the AST at each script tag not inside a template.
   */
  script: parse5.ASTNode[];
  /**
   * The entry points to the AST at style tag outside a template.
   */
  style: parse5.ASTNode[];
  import: parse5.ASTNode[];
  /**
   * The entry points to the AST at each outermost dom-module element.
   */
  'dom-module': parse5.ASTNode[];
  comment: parse5.ASTNode[];
  /**
   * The full parse5 ast for the document.
   */
  ast: parse5.ASTNode;
}

export function getOwnerDocument(node: parse5.ASTNode): parse5.ASTNode {
  while (node && !dom5.isDocument(node)) {
    node = node.parentNode;
  }
  return node;
}

export class HtmlParser implements Parser<ParsedImport> {

  /**
  * Parse html into ASTs.
  *
  * htmlString is a utf8, html5 document containing polymer elements
  * or module definitons.
  *
  * href is the path of the document.
  */
  parse(htmlString: string, href: string): ParsedImport {
    let doc: parse5.ASTNode;

    doc = parse5.parse(htmlString, {locationInfo: true});

    let registry: ParsedImport = {
        base: [],
        template: [],
        script: [],
        style: [],
        import: [],
        'dom-module': [],
        comment: [],
        ast: doc};

    let queue = [].concat(doc.childNodes);
    let nextNode: ASTNode;
    while (queue.length > 0) {
      nextNode = queue.shift();
      if (nextNode) {
        queue = queue.concat(nextNode.childNodes);
        addNode(nextNode, registry);
      }
    }
    return registry;
  }

}
