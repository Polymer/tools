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

import * as shady from 'shady-css-parser';

import {SourceRange} from '../model/model';
import {Options, ParsedDocument, StringifyOptions} from '../parser/document';

import cssbeautify = require('cssbeautify');

export interface Visitor { visit(node: shady.Node, path: shady.Node[]): void; }

class ShadyVisitor extends shady.NodeVisitor<shady.Node, void> {
  private visitors: Visitor[];
  constructor(visitors: Visitor[]) {
    super();
    this.visitors = visitors;
  }
  private allVisitors(node: shady.Node) {
    for (const visitor of this.visitors) {
      visitor.visit(node, this.path);
    }
  }
  stylesheet(stylesheet: shady.Stylesheet) {
    this.allVisitors(stylesheet);
    for (const rule of stylesheet.rules) {
      this.visit(rule);
    }
  }
  atRule(atRule: shady.AtRule) {
    this.allVisitors(atRule);
    if (atRule.rulelist) {
      this.visit(atRule.rulelist);
    }
  }
  comment(comment: shady.Comment) {
    this.allVisitors(comment);
  }
  rulelist(rulelist: shady.Rulelist) {
    this.allVisitors(rulelist);
    for (const rule of rulelist.rules) {
      this.visit(rule);
    }
  }
  ruleset(ruleset: shady.Ruleset) {
    this.allVisitors(ruleset);
    this.visit(ruleset.rulelist);
  }
  declaration(declaration: shady.Declaration) {
    this.allVisitors(declaration);
    if (declaration.value) {
      this.visit(declaration.value);
    }
  }
  expression(expression: shady.Expression) {
    this.allVisitors(expression);
  }
  discarded(discarded: shady.Discarded) {
    this.allVisitors(discarded);
  }
}

export class ParsedCssDocument extends ParsedDocument<shady.Node, Visitor> {
  type = 'css';

  constructor(from: Options<shady.Node>) {
    super(from);
  }

  visit(visitors: Visitor[]) {
    const shadyVisitor = new ShadyVisitor(visitors);
    shadyVisitor.visit(this.ast);
  }

  protected _sourceRangeForNode(node: shady.Node): SourceRange {
    return this.offsetsToSourceRange(node.range.start, node.range.end);
  }

  stringify(options?: StringifyOptions) {
    options = options || {};
    shadyStringifier.visit;
    const beautifulResults = cssbeautify(
        shadyStringifier.stringify(this.ast),
        {indent: '  ', autosemicolon: true, openbrace: 'end-of-line'});

    const indent = '  '.repeat(options.indent || 0);

    return beautifulResults.split('\n')
               .map((line) => line === '' ? '' : indent + line)
               .join('\n') +
        '\n';
  }
}

const shadyStringifier = new shady.Stringifier();
