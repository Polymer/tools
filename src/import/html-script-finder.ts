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
import {ASTNode} from 'parse5';
import {resolve as resolveUrl} from 'url';

import {ImportFinder} from './import-finder.ts';
import {ImportDescriptor} from '../ast/ast';

const p = dom5.predicates;

const isJsScriptNode = p.AND(
  p.hasTagName('script'),
  p.hasAttr('src'),
  p.OR(
    p.NOT(p.hasAttr('type')),
    p.hasAttrValue('type', 'text/javascript'),
    p.hasAttrValue('type', 'application/javascript'),
    p.hasAttrValue('type', 'module')
  )
);

export class HtmlScriptFinder implements ImportFinder<ASTNode> {

  findImports(url: string, document: ASTNode): ImportDescriptor[] {
    let scriptTags = dom5.queryAll(document, isJsScriptNode);
    let importDescriptors = scriptTags.map((script) => {
      let src = dom5.getAttribute(script, 'src');
      let scriptUrl = resolveUrl(url, src);
      return new ImportDescriptor('html-script', scriptUrl);
    });
    return importDescriptors;
  }

}
