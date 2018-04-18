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
const isIronFormV1 = p.AND(
    (node: dom5.Node) =>
        !node.parentNode || !p.hasTagName('iron-form')(node.parentNode),
    p.hasTagName('form'),
    p.hasAttrValue('is', 'iron-form'));

const propertiesToDelete: ReadonlySet<string> = new Set([
  'is',
  'disable-native-validation-ui',
  'disable-native-validation-ui$',
  'request',
  'request$',
]);
const propertiesToMove: ReadonlySet<string> = new Set([
  'id',
  'id$',
  'headers',
  'headers$',
  'with-credentials',
  'with-credentials$'
]);
const propertiesToRename: ReadonlyMap<string, string> = new Map([
  ['content-type', 'enctype'],
  ['content-type$', 'enctype$'],
]);

class IronFormV1ToV2 extends HtmlRule {
  code = 'iron-form-v1-to-v2';
  description = stripIndentation(`
      Warns when \`iron-form\` is used as type extension.

      This:

          <form is="iron-form"
                method="get"
                action="/my-end-point"
                on-iron-form-error="handleError">
            <input type="text">
            <input type="submit">
          </form>

      Should instead be written as:

          <iron-form on-iron-form-error="handleError">
            <form method="get" action="/my-end-point">
              <input type="text">
              <input type="submit">
            </form>
          </iron-form>
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, _document: Document) {
    const warnings: Warning[] = [];
    const forms = dom5.queryAll(
        parsedDocument.ast, isIronFormV1, dom5.childNodesIncludeTemplate);
    for (const form of forms) {
      // Collect attributes/events for the iron-form and form.
      let ironFormAttrs = '', formAttrs = '';
      form.attrs.forEach((attr) => {
        // All `iron-form-*` events and `propertiesToMove` go on <iron-form>.
        if ((attr.name.indexOf('on-iron-form-') === 0 ||
             propertiesToMove.has(attr.name))) {
          ironFormAttrs +=
              ` ${attr.name}${attr.value ? `="${attr.value}"` : ''}`;
        } else if (!propertiesToDelete.has(attr.name)) {
          const attrName = propertiesToRename.get(attr.name) || attr.name;
          formAttrs += ` ${attrName}${attr.value ? `="${attr.value}"` : ''}`;
        }
      });
      const indentation = getIndentationInside(form.parentNode!);
      const startLinebreak = indentation ? '\n' + indentation + '  ' : '';
      const endLinebreak = indentation ? '\n' + indentation : '';
      const formStartTagRange = parsedDocument.sourceRangeForStartTag(form)!;
      const formEndTagRange = parsedDocument.sourceRangeForEndTag(form)!;
      const fix: Replacement[] = [
        {
          range: formStartTagRange,
          replacementText:
              `<iron-form${ironFormAttrs}>${startLinebreak}<form${formAttrs}>`
        },
        {
          range: formEndTagRange,
          replacementText: `</form>${endLinebreak}</iron-form>`
        }
      ];
      // Indent also the <form> content.
      if (indentation) {
        for (let i = formStartTagRange.end.line + 1;
             i <= formEndTagRange.end.line;
             i++) {
          const position = {line: i, column: 0};
          fix.push({
            range: {file: parsedDocument.url, start: position, end: position},
            replacementText: '  '
          });
        }
      }
      warnings.push(new Warning({
        parsedDocument,
        code: this.code,
        message:
            `<form> should not be extended with \`is="iron-form"\` but instead wrapped with \`<iron-form>\`.`,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForAttribute(form, 'is')!, fix
      }));
    }

    return warnings;
  }
}

registry.register(new IronFormV1ToV2());