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
import {Document, ParsedHtmlDocument, Replacement, Severity, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../../html/rule';
import {registry} from '../../registry';
import {stripIndentation} from '../../util';
import { ASTAttribute } from 'parse5';

const p = dom5.predicates;
const isPaperInputElement = p.AND(
  p.OR(
    p.hasTagName('paper-input'),
    p.hasTagName('paper-input-container'),
    p.hasTagName('paper-textarea')),
  p.NOT(p.hasAttr('use-v2-underline')));

class PaperInputV1ToV2 extends HtmlRule {
  code = 'paper-input-v1-to-v2';
  description = stripIndentation(``);

  async checkDocument(parsedDocument: ParsedHtmlDocument, _document: Document) {
    const warnings: Warning[] = [];
    const inputs = dom5.queryAll(
        parsedDocument.ast, isPaperInputElement, dom5.childNodesIncludeTemplate);
    for (const input of inputs) {
      const tagName = input.tagName!.toLowerCase();
      const inputStartTagRange = parsedDocument.sourceRangeForStartTag(input)!;

      // indent attributes if they are on multiple lines
      let inputAttrNewline = ' ';
      if ((inputStartTagRange.end.line - inputStartTagRange.start.line) > 0) {
        inputAttrNewline = `\n${' '.repeat(inputStartTagRange.start.column + 4)}`;
      }

      // Collect attributes/events for the paper-input and input.
      let inputAttrs = '';
      const inputAttributes = input.attrs;
      const hasUnderlineAttr = inputAttributes.reduce((hasUnderlineAttr, attribute) => {
        return hasUnderlineAttr || attribute.name === 'use-v2-underline';
      }, false);

      if (!hasUnderlineAttr) {
        const underlineAttr: ASTAttribute = {
          name: 'use-v2-underline',
          value: ''
        };

        inputAttributes.push(underlineAttr);
      }

      inputAttributes.forEach((attr) => {
        inputAttrs +=
            `${inputAttrNewline}${attr.name}${attr.value ? `="${attr.value}"` : ''}`;
      });
      const fix: Replacement[] = [
        {
          range: inputStartTagRange,
          replacementText:
              `<${tagName}${inputAttrs}>`
        }
      ];
      warnings.push(new Warning({
        parsedDocument,
        code: this.code,
        message: `<${tagName}> does not have attribute \`use-v2-underline\`.`,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForStartTag(input)!,
        fix
      }));
    }

    return warnings;
  }
}

registry.register(new PaperInputV1ToV2());