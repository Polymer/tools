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

import * as dom5 from 'dom5/lib/index-next';
import * as parse5 from 'parse5';
import stripIndent = require('strip-indent');

import {registry} from '../../registry';
import {HtmlRule} from '../../html/rule';
import {ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {nodeIsTemplateExtension} from './utils';

class PaperToolbarV1ToV2 extends HtmlRule {
  code = 'paper-toolbar-v1-to-v2';
  description = stripIndent(`
    Warns when children of <paper-toolbar> do not have slots. <paper-toolbar>
    v2 does not have a default slot and \`class="middle"\` / \`class="bottom"\`
    no longer cause children to be distributed.

    Child elements now need a slot; the 'top' slot is equivalent to the default
    distribution position from v1, the 'middle' and 'bottom' slots correspond to
    the distribution position for elements with 'middle' or 'bottom' as a class.

    Non-whitespace-only child text nodes, which can't be distributed to a named
    slot, should be have their non-whitespace portion wrapped in a span
    distributed to the 'top' slot: \`<span slot="top">\` ... \`</span>\`.

    Example usage of <paper-toolbar> v1:

      <paper-toolbar>
        <!-- 1 -->
        <div>
          This element is in the top bar (default).
        </div>

        <!-- 2 -->
        <div class="middle">
          This element is in the middle bar.
        </div>

        <!-- 3 -->
        <div class="bottom">
          This element is in the bottom bar.
        </div>

        <!-- 4 -->
        This text node has non-whitespace characters.
      </paper-toolbar>

    After updating to <paper-toolbar> v2:

      <paper-toolbar>
        <!-- 1 -->
        <div slot="top">
          This element is in the top bar (default).
        </div>

        <!-- 2 -->
        <div class="middle" slot="middle">
          This element is in the middle bar.
        </div>

        <!-- 3 -->
        <div class="bottom" slot="bottom">
          This element is in the bottom bar.
        </div>

        <!-- 4 -->
        <span slot="top">This text node has non-whitespace characters.</span>
      </paper-toolbar>
  `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument) {
    const warnings: Warning[] = [];

    const paperToolbars = dom5.queryAll(
        parsedDocument.ast,
        dom5.predicates.hasTagName('paper-toolbar'),
        dom5.childNodesIncludeTemplate);

    const checkNode = (node: dom5.Node) => {
      // Add the appropriate slot for the element: `slot="middle"` or
      // `slot="bottom"` for elements with a 'middle' or 'bottom' class,
      // `slot="top"` for all others.
      if (node.tagName !== undefined && !dom5.hasAttribute(node, 'slot')) {
        let desiredSlot = 'top';
        if (dom5.hasSpaceSeparatedAttrValue('class', 'middle')(node)) {
          desiredSlot = 'middle';
        }
        if (dom5.hasSpaceSeparatedAttrValue('class', 'bottom')(node)) {
          desiredSlot = 'bottom';
        }

        const startTagSourceRange =
            parsedDocument.sourceRangeForStartTag(node)!;
        const [startOffset, endOffset] =
            parsedDocument.sourceRangeToOffsets(startTagSourceRange);
        const startTagText =
            parsedDocument.contents.slice(startOffset, endOffset);
        const isSelfClosing = startTagText.endsWith('/>');

        warnings.push(new Warning({
          parsedDocument,
          code: this.code,
          message: '<paper-toolbar> no longer has a default slot: this ' +
              'element will not appear in the composed tree. Add `slot="top"` ' +
              'to distribute to the same position as the previous default ' +
              'content or `slot="middle"` / `slot="bottom"` to distribute to ' +
              'the middle or bottom bar.',
          severity: Severity.WARNING,
          sourceRange: startTagSourceRange,
          fix: [{
            range: startTagSourceRange,
            replacementText: startTagText.slice(0, isSelfClosing ? -2 : -1) +
                ` slot="${desiredSlot}"` + (isSelfClosing ? '/' : '') + '>',
          }],
        }));
      }

      // Non-whitespace-only text nodes, which were previously distributed into
      // a default slot, now need to be wrapped in `<span
      // slot="top">...</span>`.
      if (node.nodeName === '#text' && node.value!.trim() !== '') {
        const textNodeSourceRange = parsedDocument.sourceRangeForNode(node)!;

        const fullText = node.value!;
        const trimmedText = fullText.trim();
        const trimmedOffset = fullText.indexOf(trimmedText);

        const treeAdapter = parse5.treeAdapters.default;
        const fragment = treeAdapter.createDocumentFragment();

        // Leading whitespace:
        dom5.append(fragment, {
          nodeName: '#text',
          value: fullText.substring(0, trimmedOffset),
        } as parse5.ASTNode);

        // Wrapped text:
        const span = treeAdapter.createElement('span', '', []);
        dom5.setAttribute(span, 'slot', 'top');
        dom5.append(span, {
          nodeName: '#text',
          value: trimmedText,
        } as parse5.ASTNode);
        dom5.append(fragment, span);

        // Trailing whitespace:
        dom5.append(fragment, {
          nodeName: '#text',
          value: fullText.substring(trimmedOffset + trimmedText.length),
        } as parse5.ASTNode);

        warnings.push(new Warning({
          parsedDocument,
          code: this.code,
          message: '<paper-toolbar> no longer has a default slot: this ' +
              'text node will not appear in the composed tree. Wrap with ' +
              '`<span slot="top">...</span>` to distribute to the same ' +
              'position as the previous default content.',
          severity: Severity.WARNING,
          sourceRange: textNodeSourceRange,
          fix: [{
            range: textNodeSourceRange,
            replacementText: parse5.serialize(fragment),
          }],
        }));
      }
    };

    for (const paperToolbar of paperToolbars) {
      let suspectNodes = Array.from(paperToolbar.childNodes!);

      while (suspectNodes.some(nodeIsTemplateExtension)) {
        suspectNodes =
            suspectNodes
                .map((node) => {
                  if (nodeIsTemplateExtension(node)) {
                    return Array.from(dom5.childNodesIncludeTemplate(node)!);
                  }

                  return [node];
                })
                .reduce((a, b) => a.concat(b), []);
      }

      for (const node of suspectNodes) {
        checkNode(node);
      }
    }

    return warnings;
  }
}

registry.register(new PaperToolbarV1ToV2());
