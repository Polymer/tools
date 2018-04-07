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

import * as dom5 from 'dom5/lib/index-next';
import {ASTNode} from 'parse5';

import {HtmlVisitor, ParsedHtmlDocument} from '../html/html-document';
import {HtmlScanner} from '../html/html-scanner';
import {getOrInferPrivacy} from '../javascript/esutil';
import * as jsdoc from '../javascript/jsdoc';

import {annotateElementHeader} from './docs';
import {ScannedPolymerElement} from './polymer-element';

/**
 * A Polymer pseudo-element is an element that is declared in an unusual way,
 * such
 * that the analyzer couldn't normally analyze it, so instead it is declared in
 * comments.
 */
export class PseudoElementScanner implements HtmlScanner {
  async scan(
      document: ParsedHtmlDocument,
      visit: (visitor: HtmlVisitor) => Promise<void>) {
    const elements: ScannedPolymerElement[] = [];

    await visit((node: ASTNode) => {
      if (dom5.isCommentNode(node) && node.data &&
          node.data.includes('@pseudoElement')) {
        const parsedJsdoc = jsdoc.parseJsdoc(node.data);
        const pseudoTag = jsdoc.getTag(parsedJsdoc, 'pseudoElement');
        const tagName = pseudoTag && pseudoTag.name;
        if (tagName) {
          const element = new ScannedPolymerElement({
            astNode: node,
            statementAst: undefined,
            tagName: tagName,
            jsdoc: parsedJsdoc,
            description: parsedJsdoc.description,
            sourceRange: document.sourceRangeForNode(node),
            privacy: getOrInferPrivacy(tagName, parsedJsdoc),
            abstract: jsdoc.hasTag(parsedJsdoc, 'abstract'),
            properties: [],
            attributes: new Map(),
            events: new Map(),
            listeners: [],
            behaviors: [],
            className: undefined,
            extends: undefined,
            staticMethods: new Map(),
            methods: new Map(),
            mixins: [],
            observers: [],
            superClass: undefined
          });
          element.pseudo = true;
          annotateElementHeader(element);
          elements.push(element);
        }
      }
    });
    return {features: elements};
  }
}
