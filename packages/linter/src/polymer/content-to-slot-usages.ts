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
import {treeAdapters} from 'parse5';
import {Document, Element, ParsedHtmlDocument, Replacement, Severity, Slot, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {elementSelectorToPredicate} from '../html/util';
import {registry} from '../registry';
import {stripIndentation} from '../util';

class ContentToSlot extends HtmlRule {
  code = 'content-to-slot-usages';
  description = stripIndentation(`
      Warns when an element should have a \`slot\` attribute but does not.
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];

    const elements = document.getFeatures({kind: 'element'});
    for (const element of elements) {
      // Look for selector errors in locally defined elements.
      const result = determineMigrationDescriptors(element);
      if (!result.success) {
        for (const error of result.value) {
          if (error.slot.astNode === undefined ||
              error.slot.astNode.language !== 'html') {
            continue;
          }
          warnings.push(new Warning({
            code: 'invalid-old-content-selector',
            parsedDocument,
            severity: Severity.WARNING,
            message: error.message,
            sourceRange: parsedDocument.sourceRangeForAttributeValue(
                             error.slot.astNode.node, 'old-content-selector') ||
                parsedDocument.sourceRangeForStartTag(error.slot.astNode.node)!
          }));
        }
      }
    }

    const references = document.getFeatures({kind: 'element-reference'});
    for (const reference of references) {
      const contentDescriptors =
          getMigrationDescriptors(reference.tagName, document);
      if (!contentDescriptors) {
        continue;
      }
      const fix: Replacement[] = [];
      const matchedSoFar = new Set<dom5.Node>();
      for (const {predicate, slot} of contentDescriptors) {
        const matchingLightContents: dom5.Node[] = [];
        function matchChildNodes(node: dom5.Node) {
          for (const child of node.childNodes || []) {
            if (child.tagName === 'template') {
              const content = treeAdapters.default.getTemplateContent(child);
              matchChildNodes(content);
            } else if (predicate(child)) {
              matchingLightContents.push(child);
            }
          }
        }
        matchChildNodes(reference.astNode.node);
        for (const lightContent of matchingLightContents) {
          if (dom5.hasAttribute(lightContent, 'slot')) {
            continue;
          }
          const range = parsedDocument.sourceRangeForStartTag(lightContent);
          if (!range) {
            continue;
          }
          if (matchedSoFar.has(lightContent)) {
            continue;
          }
          matchedSoFar.add(lightContent);
          const [startOffset, endOffset] =
              parsedDocument.sourceRangeToOffsets(range);
          const originalText =
              parsedDocument.contents.slice(startOffset, endOffset);
          if (!originalText.endsWith('>')) {
            // Something weird is going on, don't make any changes.
            continue;
          }
          let justBeforeTagClose = -1;
          let tagCloseSyntax = '>';
          if (originalText.endsWith('/>')) {
            justBeforeTagClose = -2;
            tagCloseSyntax = '/>';
          }

          const withSlotAttr = originalText.slice(0, justBeforeTagClose) +
              ` slot="${slot}"${tagCloseSyntax}`;

          fix.push({range, replacementText: withSlotAttr});
        }
      }
      if (fix.length > 0) {
        warnings.push(new Warning({
          code: 'content-to-slot-usage-site',
          message: `Deprecated <content>-based distribution into ` +
              `<${reference.tagName}>. ` +
              `Must use the \`slot\` attribute for named distribution."`,
          parsedDocument,
          severity: Severity.WARNING,
          sourceRange:
              parsedDocument.sourceRangeForStartTag(reference.astNode.node)!,
          fix
        }));
      }
    }
    return warnings;
  }
}

/**
 * Describes how what elements to add a certain slot attribute to, when
 * migrating usages of a certain element from content to slot.
 */
interface SlotMigrationDescriptor {
  /** If an element matches this predicate... */
  predicate: dom5.Predicate;
  /** ... it should be given a slot attribute with this as its value. */
  slot: string;
}

/**
 * Returns a description of how to migrate the children of a given element to
 * distribute using slots rather than the shadow dom v0 content system. This
 * assumes that the given element has already been migrated to slots, and is
 * either statically known to the linter (see configuration below), or uses the
 * `old-content-selector` attribute to explain how it used to do distribution.
 */
function getMigrationDescriptors(tagName: string, document: Document):
    ReadonlyArray<SlotMigrationDescriptor>|undefined {
  const [element, ] = document.getFeatures(
      {kind: 'element', id: tagName, imported: true, externalPackages: true});
  if (element) {
    const result = determineMigrationDescriptors(element);
    // If we can determine descriptors dynamically, return those.
    if (result.success && result.value.length > 0) {
      return result.value;
    }
  }

  // Otherwise, try to get the descriptors from our hardcoded knowledge of
  // elements.
  return staticConfig.get(tagName);
}

class DescriptorError {
  constructor(public readonly message: string, public readonly slot: Slot) {
  }
}

type Result<Good, Bad> = {
  success: true,
  value: Good
}|{success: false, value: Bad};
type MigrationResult = Result<
    ReadonlyArray<SlotMigrationDescriptor>,
    ReadonlyArray<DescriptorError>>;

const descriptorsCache = new WeakMap<Element, MigrationResult>();
function determineMigrationDescriptors(element: Element): MigrationResult {
  const cachedResult = descriptorsCache.get(element);
  if (cachedResult) {
    return cachedResult;
  }
  const descriptors = [];
  const errors = [];
  for (const slot of element.slots) {
    if (slot.astNode && slot.astNode.language === 'html') {
      const selector =
          dom5.getAttribute(slot.astNode.node, 'old-content-selector');
      if (!selector) {
        continue;
      }
      try {
        descriptors.push(
            {predicate: elementSelectorToPredicate(selector), slot: slot.name});
      } catch (e) {
        errors.push(new DescriptorError(e.message || ('' + e), slot));
      }
    }
  }
  let result: MigrationResult;
  if (errors.length > 0) {
    result = {success: false, value: errors};
  } else {
    result = {success: true, value: descriptors};
  }
  descriptorsCache.set(element, result);
  return result;
}

const staticConfig =
    new Map<string, Array<{predicate: dom5.Predicate, slot: string}>>();

// Configure statically known slot->content conversions.
function addPredicate(
    tagname: string, slots: Array<{selector: string, slot: string}>) {
  staticConfig.set(
      tagname, slots.map((s) => ({
                           predicate: elementSelectorToPredicate(s.selector),
                           slot: s.slot
                         })));
}

addPredicate(
    'paper-header-panel',
    [{selector: 'paper-toolbar, .paper-header', slot: 'header'}]);

addPredicate('paper-scroll-header-panel', [
  {selector: 'paper-toolbar, .paper-header', slot: 'header'},
  {selector: '*', slot: 'content'}
]);

addPredicate('paper-drawer-panel', [
  {selector: '[drawer]', slot: 'drawer'},
  {selector: '[main]', slot: 'main'}
]);

addPredicate('paper-icon-item', [{selector: '[item-icon]', slot: 'item-icon'}]);

addPredicate('paper-menu-button', [
  {selector: '.dropdown-trigger', slot: 'dropdown-trigger'},
  {selector: '.dropdown-content', slot: 'dropdown-content'},
]);

addPredicate(
    'iron-dropdown',
    [{selector: '.dropdown-content', slot: 'dropdown-content'}]);

addPredicate('paper-input', [
  {selector: '[prefix]', slot: 'prefix'},
  {selector: '[suffix]', slot: 'suffix'},
]);

addPredicate('paper-input-container', [
  {selector: '[prefix]', slot: 'prefix'},
  {selector: '[suffix]', slot: 'suffix'},
  {selector: '[add-on]', slot: 'add-on'},
  {selector: 'label', slot: 'label'},
  {selector: '*', slot: 'input'},
]);

addPredicate(
    'paper-dropdown-menu',
    [{selector: '.dropdown-content', slot: 'dropdown-content'}]);


registry.register(new ContentToSlot());
