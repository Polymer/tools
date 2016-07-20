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
import {Document, DocumentInit} from './document';
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
export class HtmlDocument extends Document<parse5.ASTNode> {
  type: 'html';
}
