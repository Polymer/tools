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
import {ParsedHtmlDocument} from 'polymer-analyzer/lib/html/html-document';
import {Document} from 'polymer-analyzer/lib/model/model';

import stripIndent = require('strip-indent');
import {Warning, Severity} from 'polymer-analyzer/lib/warning/warning';

import {Rule} from '../rule';

const p = dom5.predicates;

export class MoveStyleIntoTemplate extends Rule {
  code = 'style-into-template';
  description = stripIndent(`
      Transforms:

          <dom-module>
            <style></style>
            <template>foo</template>
          <dom-module>

      Into:

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

  async check(document: Document) {
    const warnings: Warning[] = [];
    const parsedDocument = document.parsedDocument;
    if (!(parsedDocument instanceof ParsedHtmlDocument)) {
      return warnings;
    }
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
