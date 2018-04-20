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

import {Document, ParsedCssDocument, Severity, Warning} from 'polymer-analyzer';
import * as shady from 'shady-css-parser';

import {CssRule} from '../css/rule';
import {registry} from '../registry';
import {stripIndentation} from '../util';

class DeprecatedCustomPropertySyntax extends CssRule {
  code = 'deprecated-css-custom-property-syntax';
  description = stripIndentation(`
      Warns when using deprecated css syntax around CSS Custom Properties.
  `);

  async checkDocument(parsedDocument: ParsedCssDocument, _document: Document) {
    const warnings: Warning[] = [];

    for (const node of parsedDocument) {
      this.addAtApplyWarnings(node, parsedDocument, warnings);
      this.addVarSyntaxWarnings(node, parsedDocument, warnings);
    }

    return warnings;
  }

  // Convert `@apply(--foo);` to `@apply --foo;`
  private addAtApplyWarnings(
      node: shady.Node, parsedDocument: ParsedCssDocument,
      warnings: Warning[]) {
    if (node.type === shady.nodeType.atRule && node.name === 'apply') {
      if (node.parametersRange && node.parameters.startsWith('(') &&
          node.parameters.endsWith(')')) {
        warnings.push(new Warning({
          code: 'at-apply-with-parens',
          parsedDocument,
          severity: Severity.ERROR,
          sourceRange:
              parsedDocument.sourceRangeForShadyRange(node.parametersRange),
          message:
              '@apply with parentheses is deprecated. Prefer: @apply --foo;',
          fix: [
            {
              range: parsedDocument.sourceRangeForShadyRange({
                start: node.parametersRange.start,
                end: node.parametersRange.start + 1
              }),
              replacementText: ' '
            },
            {
              range: parsedDocument.sourceRangeForShadyRange({
                start: node.parametersRange.end - 1,
                end: node.parametersRange.end
              }),
              replacementText: ''
            }
          ]
        }));
      }
    }
  }

  // Convert `var(--foo, --bar)` to `var(--foo, var(--bar))`
  private addVarSyntaxWarnings(
      node: shady.Node, parsedDocument: ParsedCssDocument,
      warnings: Warning[]) {
    if (node.type === shady.nodeType.expression) {
      const match = node.text.match(
          /var\s*\(\s*--[a-zA-Z0-9_-]+\s*,\s*(--[a-zA-Z0-9_-]+)\s*\)/);
      if (match !== null) {
        const offsetOfVarInsideExpression = match.index!;
        const offsetOfSecondCustomPropWithinVar =
            match[0].match(/--[a-zA-Z0-9_-]+\s*\)$/)!.index!;
        const secondCustomProp = match[1];
        const newText = `var(${secondCustomProp})`;
        const start = node.range.start + offsetOfVarInsideExpression +
            offsetOfSecondCustomPropWithinVar;
        const end = start + secondCustomProp.length;
        const sourceRange =
            parsedDocument.sourceRangeForShadyRange({start, end});
        warnings.push(new Warning({
          code: 'invalid-second-arg-to-var-expression',
          severity: Severity.WARNING, parsedDocument, sourceRange,
          message:
              'When the second argument to a var() expression is another ' +
              'custom property, it must also be wrapped in a var().',
          fix: [{range: sourceRange, replacementText: newText}]
        }));
      }
    }
  }
}

registry.register(new DeprecatedCustomPropertySyntax());
