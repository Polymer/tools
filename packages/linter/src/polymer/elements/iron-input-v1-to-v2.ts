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
import {getIndentationInside} from '../../html/util';
import {registry} from '../../registry';
import {stripIndentation} from '../../util';

const p = dom5.predicates;
const isIronInputV1 = p.AND(
    (node: dom5.Node) =>
        !node.parentNode || !p.hasTagName('iron-input')(node.parentNode),
    p.hasTagName('input'),
    p.hasAttrValue('is', 'iron-input'));

const propertiesToDelete: ReadonlySet<string> = new Set([
]);
const propertiesToCopy: ReadonlySet<string> = new Set([
  'bind-value',
  'allowed-pattern',
  'invalid',
  'validator',
  'id',
  'id$',
]);
const propertiesToMove: ReadonlySet<string> = new Set([
  'slot',
]);
const propertiesToRename: ReadonlyMap<string, string> = new Map([
]);

class IronInputV1ToV2 extends HtmlRule {
  code = 'iron-input-v1-to-v2';
  description = stripIndentation(`
      Warns when \`iron-input\` is used as type extension.

      This:

          <input is="iron-input"
                bind-value="{{boundVal}}">
            <input type="text">
            <input type="submit">
          </input>

      Should instead be written as:

          <iron-input on-iron-input-error="handleError">
            <input method="get" action="/my-end-point">
              <input type="text">
              <input type="submit">
            </input>
          </iron-input>
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, _document: Document) {
    const warnings: Warning[] = [];
    const inputs = dom5.queryAll(
        parsedDocument.ast, isIronInputV1, dom5.childNodesIncludeTemplate);
    for (const input of inputs) {
      const indentation = getIndentationInside(input.parentNode!);
      const startLinebreak = indentation ? '\n' + indentation + '  ' : '';
      const endLineBreak = indentation ? '\n' + indentation : '';
      const inputStartTagRange = parsedDocument.sourceRangeForStartTag(input)!;

      // indent attributes if they are on multiple lines
      let ironInputAttrNewline = ' ';
      let inputAttrNewline = ' ';
      if ((inputStartTagRange.end.line - inputStartTagRange.start.line) > 0) {
        ironInputAttrNewline = `\n${' '.repeat(inputStartTagRange.start.column + 4)}`;
        inputAttrNewline = `\n${' '.repeat(inputStartTagRange.start.column + 6)}`;
      }

      // Collect attributes/events for the iron-input and input.
      let ironInputAttrs = '', inputAttrs = '';
      input.attrs.forEach((attr) => {
        // All `iron-input-*` events and `propertiesToMove` go on <iron-input>.
        if ((attr.name.indexOf('on-iron-input-') === 0 ||
             propertiesToMove.has(attr.name))) {
          ironInputAttrs +=
              `${ironInputAttrNewline}${attr.name}${attr.value ? `="${attr.value}"` : ''}`;
        } else if (propertiesToCopy.has(attr.name)) {
          const attrValue = attr.name === 'id' || attr.name === 'id$' ?
              `${attr.value}Custom` : attr.value;
          const attrName = propertiesToRename.get(attr.name) || attr.name;
          ironInputAttrs += `${ironInputAttrNewline}${attrName}${attrValue ? `="${attrValue}"` : ''}`;
          inputAttrs += `${inputAttrNewline}${attrName}${attr.value ? `="${attr.value}"` : ''}`;
        } else if (!propertiesToDelete.has(attr.name)) {
          const attrName = propertiesToRename.get(attr.name) || attr.name;
          inputAttrs += `${inputAttrNewline}${attrName}${attr.value ? `="${attr.value}"` : ''}`;
        }
      });
      const fix: Replacement[] = [
        {
          range: inputStartTagRange,
          replacementText:
              `<iron-input${ironInputAttrs}>${startLinebreak}<input${inputAttrs}>${endLineBreak}</iron-input>`
        }
      ];
      warnings.push(new Warning({
        parsedDocument,
        code: this.code,
        message:
            `<input> should not be extended with \`is="iron-input"\` but instead wrapped with \`<iron-input>\`.`,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForAttribute(input, 'is')!,
        fix
      }));
    }

    return warnings;
  }
}

registry.register(new IronInputV1ToV2());