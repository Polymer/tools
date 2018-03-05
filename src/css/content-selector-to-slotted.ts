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

import {Document, ParsedCssDocument, Replacement, Severity, Warning} from 'polymer-analyzer';
import * as shady from 'shady-css-parser';

import {CssRule} from '../css/rule';
import {registry} from '../registry';
import {stripIndentation} from '../util';

class ContentToSlottedUsages extends CssRule {
  code = 'content-selector-to-slotted';
  description = stripIndentation(`
      Warns when using deprecated ::content pseudo-element.
  `);

  async checkDocument(parsedDocument: ParsedCssDocument, _document: Document) {
    const warnings: Warning[] = [];

    for (const node of parsedDocument) {
      if (node.type === shady.nodeType.ruleset) {
        const deprecatedRegex = /::content/;
        const match = node.selector.match(deprecatedRegex);

        if (match !== null) {
          const combinatorOffset = match.index!;
          const start = node.range.start + combinatorOffset;
          const end = start + match[0].length;
          const sourceRange =
              parsedDocument.sourceRangeForShadyRange({start, end});

          let fix: ReadonlyArray<Replacement>|undefined;
          // Safe fix only if we know the selector is immediate descendant
          const safeFixRegex = /::content\s*>\s*([^\s]+)$/;
          const descendantSelectorMatch = node.selector.match(safeFixRegex);
          if (descendantSelectorMatch !== null) {
            const descendantSelectorIndex =
                node.selector.indexOf(descendantSelectorMatch[1]);
            fix = [
              {
                range: parsedDocument.sourceRangeForShadyRange(
                    {start, end: node.range.start + descendantSelectorIndex}),
                replacementText: '::slotted('
              },
              {
                range: parsedDocument.sourceRangeForShadyRange({
                  start: node.range.start + descendantSelectorIndex +
                      descendantSelectorMatch[1].length,
                  end: node.range.start + descendantSelectorIndex +
                      descendantSelectorMatch[1].length
                }),
                replacementText: ')'
              }
            ];
          }

          warnings.push(new Warning({
            code: 'content-selector-to-slotted',
            severity: Severity.WARNING, parsedDocument, sourceRange,
            message:
                'The ::content pseudo-element has been deprecated in favor of ' +
                'the ::slotted psuedo-element in ShadowDOM v1.',
            fix
          }));
        }
      }
    }

    return warnings;
  }
}

registry.register(new ContentToSlottedUsages());