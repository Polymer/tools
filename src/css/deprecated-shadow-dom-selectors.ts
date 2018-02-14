/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

import {Document, ParsedCssDocument, Severity, Warning} from 'polymer-analyzer';
import * as shady from 'shady-css-parser';

import {CssRule} from '../css/rule';
import {registry} from '../registry';
import {stripIndentation} from '../util';

class DeprecatedShadowPiercingCombinators extends CssRule {
  code = 'deprecated-shadow-dom-selectors';
  description = stripIndentation(`
      Warns when using deprecated Shadow DOM selectors.
  `);

  async checkDocument(parsedDocument: ParsedCssDocument, _document: Document) {
    const warnings: Warning[] = [];

    for (const node of parsedDocument) {
      if (node.type === shady.nodeType.ruleset) {
        const deprecatedCombinatorsRegex = /(\/deep\/|>>>|::shadow)/g;
        let match: RegExpExecArray|null;

        while ((match = deprecatedCombinatorsRegex.exec(node.selector)) !==
               null) {
          const combinatorOffset = match.index!;
          const start = node.range.start + combinatorOffset;
          const end = start + match[0].length;
          const sourceRange =
              parsedDocument.sourceRangeForShadyRange({start, end});
          warnings.push(new Warning({
            code: 'deprecated-shadow-dom-selectors',
            severity: Severity.WARNING, parsedDocument, sourceRange,
            message:
                'The /deep/ (>>>) combinator and ::shadow pseudo-element ' +
                'have been deprecated.',
          }));
        }
      }
    }

    return warnings;
  }
}

registry.register(new DeprecatedShadowPiercingCombinators());