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
import {treeAdapters} from 'parse5';
import {Action, Document, Edit, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {stripIndentation} from '../util';


const p = dom5.predicates;

// TODO: this should be in default collections, but it shouldn't have a
//     fix, because the fix isn't safe, it introduces a breaking change.
//     https://github.com/Polymer/polymer-linter/issues/111

class ContentToSlotDeclarations extends HtmlRule {
  code = 'content-to-slot-declarations';
  description = stripIndentation(`
      Warns when using <content> instead of Shadow Dom v1's <slot> element.

      This warning is automatically fixable, and also supports an edit action
      to convert:
          <content select=".foo"></content>

      To:
          <slot name="foo" old-content-selector=".foo"></slot>
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];

    for (const domModule of document.getFeatures({kind: 'dom-module'})) {
      const template =
          dom5.query(domModule.astNode.node, p.hasTagName('template'));
      if (!template) {
        continue;
      }
      const contentElements = dom5.queryAll(
          treeAdapters.default.getTemplateContent(template),
          p.hasTagName('content'),
          dom5.childNodesIncludeTemplate);
      const slotNames = new Set<string>();
      for (const contentElement of contentElements) {
        const result = getSerializedSlotElement(contentElement, slotNames);
        let fix = undefined;
        let actions: undefined|Action[] = undefined;
        if (result !== undefined) {
          const {slotElementStartTagText, isSafe} = result;
          const slotElementStartTag = slotElementStartTagText.slice(
              0, -7); /* cut </slot> off the end */
          const edit: Edit = [
            {
              replacementText: slotElementStartTag,
              range: parsedDocument.sourceRangeForStartTag(contentElement)!
            },
            {
              replacementText: '</slot>',
              range: parsedDocument.sourceRangeForEndTag(contentElement)!
            }
          ];
          if (isSafe) {
            fix = edit;
          } else {
            actions = [{
              kind: 'edit',
              code: 'content-with-select',
              description: stripIndentation(`
                Convert to a <slot> element. This is a breaking change!

                This changes the API of this element because the \`select\`
                attribute will become a slot name. Use the
                content-to-slot-usages lint pass to convert usages of the
                element to conform to the new API.
              `),
              edit
            }];
          }
        }
        warnings.push(new Warning({
          code: 'content-to-slot-declaration',
          message:
              `<content> tags are part of the deprecated Shadow Dom v0 API. ` +
              `Replace with a <slot> tag.`,
          parsedDocument,
          severity: Severity.WARNING,
          sourceRange: parsedDocument.sourceRangeForStartTag(contentElement)!,
          fix,
          actions
        }));
      }
    }
    return warnings;
  }
}

/**
 * Given a <content> element, return a serialized <slot> element to replace it.
 *
 * This requires coming up with a unique slot name, stashing the selector so
 * that we can migrate users, and copying over any other attributes. Children of
 * the <content> element aren't touched, as we're just replacing the start and
 * end tags.
 */
function getSerializedSlotElement(
    contentElement: dom5.Node, slotNames: Set<string>) {
  if (dom5.hasAttribute(contentElement, 'select$')) {
    // We can't automatically fix a dynamic select statement.
    return undefined;
  }
  const attrs = [...contentElement.attrs];
  const selectorAttr = attrs.find((a) => a.name === 'select');
  const selector = selectorAttr && selectorAttr.value;
  const isSafe = selector === undefined;
  let slotName = null;
  if (selector) {
    slotName = slotNameForSelector(selector);
    while (slotNames.has(slotName)) {
      slotName += '-unique-suffix';
    }
    slotNames.add(slotName);
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
  const slotElementStartTagText = parse5.serialize(fragment);
  return {slotElementStartTagText, isSafe};
}

function slotNameForSelector(selector: string) {
  const identifierMatch = selector.match(/[a-zA-Z-_0-9]+/);
  if (identifierMatch) {
    return identifierMatch[0];
  }
  return 'rename-me';
}

registry.register(new ContentToSlotDeclarations());
