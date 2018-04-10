
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

import * as dom5 from 'dom5/lib/index-next';
import {Document, isPositionInsideRange, ParsedHtmlDocument, Replacement, Severity, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {getIndentationInside} from '../html/util';
import {registry} from '../registry';
import {indentSourceRange, stripIndentation} from '../util';

const p = dom5.predicates;
const isCustomStyleV1 = p.AND(
    (node: dom5.Node) =>
        !node.parentNode || !p.hasTagName('custom-style')(node.parentNode),
    p.hasTagName('style'),
    p.hasAttrValue('is', 'custom-style'));

class CustomStyleExtension extends HtmlRule {
  code = 'custom-style-extension';
  description = stripIndentation(`
      Warns when \`custom-style\` is used as type extension on the main document.
      This:
          <style is="custom-style">
            div {
              --app-color: red;
            }
          </style>

      Should instead be written as:
          <custom-style>
            <style is="custom-style">
              div {
                --app-color: red;
              }
            </style>
          </custom-style>
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, _document: Document) {
    const warnings: Warning[] = [];

    const customStyleTags = [...dom5.queryAll(
        parsedDocument.ast, isCustomStyleV1, dom5.childNodesIncludeTemplate)];
    if (customStyleTags.length === 0) {
      return warnings;  // Early exit quick in the trivial case.
    }

    const domModules = Array.from(_document.getFeatures({kind: 'dom-module'}));

    for (const customStyle of customStyleTags) {
      const sourceRange = parsedDocument.sourceRangeForNode(customStyle);
      if (sourceRange === undefined) {
        continue;
      }

      const inDomModule = domModules
                              .filter((domModule) => {
                                return isPositionInsideRange(
                                    sourceRange.start, domModule.sourceRange);
                              })
                              .length > 0;
      if (inDomModule) {
        continue;
      }

      const indentation = getIndentationInside(customStyle).slice(2);
      const fix: Replacement[] =
          indentSourceRange(sourceRange, `  `, parsedDocument);

      fix.push({
        range: {
          file: parsedDocument.url,
          start: sourceRange.start,
          end: sourceRange.start
        },
        replacementText: `<custom-style>\n${indentation}`
      });
      fix.push({
        range: {
          file: parsedDocument.url,
          start: sourceRange.end,
          end: sourceRange.end
        },
        replacementText: `\n${indentation}</custom-style>`
      });

      warnings.push(new Warning({
        parsedDocument,
        code: this.code,
        message:
            `<style> extended with \`is="custom-style"\` should be wrapped with \`<custom-style>\`.`,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForAttribute(customStyle, 'is')!,
        fix
      }));
    }

    return warnings;
  }
}

registry.register(new CustomStyleExtension());
