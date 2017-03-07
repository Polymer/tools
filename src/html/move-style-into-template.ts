/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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
import {ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {registry} from '../registry';

import {HtmlRule} from './rule';

import stripIndent = require('strip-indent');

const p = dom5.predicates;

export class MoveStyleIntoTemplate extends HtmlRule {
  code = 'style-into-template';
  description = stripIndent(`
      Warns about \`style\` tags in dom-modules but not in templates.

      This:

          <dom-module>
            <style></style>
            <template>foo</template>
          <dom-module>

      Should instead be written as:

          <dom-module>
            <template>
              <style></style>
              foo
            </template>
          <dom-module>
  `);

  constructor() {
    super();
  }

  async checkDocument(parsedDocument: ParsedHtmlDocument) {
    const warnings: Warning[] = [];
    const outOfPlaceStyle = p.AND(
        p.hasTagName('style'), p.parentMatches(p.hasTagName('dom-module')));
    const outOfPlaceStyles =
        dom5.nodeWalkAll(parsedDocument.ast, outOfPlaceStyle);
    for (const outOfPlaceNode of outOfPlaceStyles) {
      warnings.push({
        code: this.code,
        message:
            `<style> tags should not be direct children of <dom-module>, they should be moved into the <template>`,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForNode(outOfPlaceNode)!
      });
    }
    return warnings;
  }
}

registry.register(new MoveStyleIntoTemplate());
