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
import * as parse5 from 'parse5';
import {treeAdapters} from 'parse5';
import {Document, ParsedHtmlDocument, Severity} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {FixableWarning} from '../warning';

import stripIndent = require('strip-indent');


const p = dom5.predicates;

class ContentToSlotDeclarations extends HtmlRule {
  code = 'content-to-slot-declarations';
  description = stripIndent(`
      Warns when using <content> instead of Shadow Dom v1's <slot> element.
  `).trim();

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: FixableWarning[] = [];

    this.convertDeclarations(parsedDocument, document, warnings);

    return warnings;
  }

  convertDeclarations(
      parsedDocument: ParsedHtmlDocument, document: Document,
      warnings: FixableWarning[]) {
    for (const element of document.getFeatures({kind: 'polymer-element'})) {
      const domModule = element.domModule;
      if (!domModule) {
        continue;
      }
      const template = dom5.query(domModule, p.hasTagName('template'));
      if (!template) {
        continue;
      }
      const contentNodes = dom5.queryAll(
          treeAdapters.default.getTemplateContent(template),
          p.hasTagName('content'));
      const slots = new Set<string>();
      for (const contentNode of contentNodes) {
        const warning = new FixableWarning({
          code: 'content-to-slot-declaration',
          message:
              `<content> tags are part of the deprecated Shadow Dom v0 API. ` +
              `Replace with a <slot> tag.`,
          parsedDocument,
          severity: Severity.WARNING,
          sourceRange: parsedDocument.sourceRangeForStartTag(contentNode)!
        });
        const attrs = [...contentNode.attrs];
        const selectorAttr = attrs.find((a) => a.name === 'select');
        const selector = selectorAttr && selectorAttr.value;
        let slotName = null;
        if (selector) {
          slotName = slotNameForSelector(selector);
          while (slots.has(slotName)) {
            slotName += '-unique-suffix';
          }
          slots.add(slotName);
          attrs.unshift({name: 'name', value: slotName});
          attrs.push({name: 'old-content-selector', value: selector});
        }
        const slotElement = treeAdapters.default.createElement('slot', '', []);
        for (const {name, value} of attrs) {
          dom5.setAttribute(slotElement, name, value);
        }
        dom5.removeAttribute(slotElement, 'select');
        const fragment = parse5.treeAdapters.default.createDocumentFragment();
        dom5.append(fragment, slotElement);
        warning.fix = [
          {
            replacementText: parse5.serialize(fragment).slice(0, -7),
            range: parsedDocument.sourceRangeForStartTag(contentNode)!
          },
          {
            replacementText: '</slot>',
            range: parsedDocument.sourceRangeForEndTag(contentNode)!
          }
        ];
        warnings.push(warning);
      }
    }
  }
}

function slotNameForSelector(selector: string) {
  const identifierMatch = selector.match(/[a-zA-Z-_0-9]+/);
  if (identifierMatch) {
    return identifierMatch[0];
  }
  return 'rename-me';
}

registry.register(new ContentToSlotDeclarations());
