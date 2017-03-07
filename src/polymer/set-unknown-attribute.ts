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
import {Attribute, Document, Element, ParsedHtmlDocument, SourcePosition, Property, SourceRange, Warning, Severity} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {stripWhitespace} from '../util';

import stripIndent = require('strip-indent');
import * as levenshtein from 'fast-levenshtein';
import {isDatabindingTemplate} from './matchers';

const sharedAttributes = new Set([
  // From https://html.spec.whatwg.org/multipage/dom.html#htmlelement
  'title',
  'lang',
  'translate',
  'dir',
  'hidden',
  'tabindex',
  'accesskey',
  'draggable',
  'spellcheck',
  'innertext',
  'contextmenu',
  // https://html.spec.whatwg.org/multipage/interaction.html#elementcontenteditable
  'contenteditable',

  // https://dom.spec.whatwg.org/#interface-element
  'id',
  'class',
  'slot',


  // https://html.spec.whatwg.org/multipage/dom.html#global-attributes
  'itemid',
  'itemprop',
  'itemref',
  'itemscope',
  'itemtype',
  'is',
  'style',

  // aria-* http://www.w3.org/TR/wai-aria/states_and_properties#state_prop_def
  // role: http://www.w3.org/TR/wai-aria/host_languages#host_general_role
  'aria-activedescendant',
  'aria-atomic',
  'aria-autocomplete',
  'aria-busy',
  'aria-checked',
  'aria-controls',
  'aria-describedby',
  'aria-disabled',
  'aria-dropeffect',
  'aria-expanded',
  'aria-flowto',
  'aria-grabbed',
  'aria-haspopup',
  'aria-hidden',
  'aria-invalid',
  'aria-label',
  'aria-labelledby',
  'aria-level',
  'aria-live',
  'aria-multiline',
  'aria-multiselectable',
  'aria-orientation',
  'aria-owns',
  'aria-posinset',
  'aria-pressed',
  'aria-readonly',
  'aria-relevant',
  'aria-required',
  'aria-selected',
  'aria-setsize',
  'aria-sort',
  'aria-valuemax',
  'aria-valuemin',
  'aria-valuenow',
  'aria-valuetext',
  'role',
]);

const sharedProperties = new Set([
  // From https://html.spec.whatwg.org/multipage/dom.html#htmlelement
  'title',
  'lang',
  'translate',
  'dir',
  'hidden',
  'tab-index',
  'access-key',
  'draggable',
  'spellcheck',
  'inner-text',
  'context-menu',
  // https://html.spec.whatwg.org/multipage/interaction.html#elementcontenteditable
  'content-editable',

  // https://dom.spec.whatwg.org/#interface-element
  'id',
  'class-name',
  'slot',


  'is',
]);


export class SetUnknownAttribute extends HtmlRule {
  code = 'set-unknown-attribute';
  description = stripIndent(`
      Warns when setting undeclared properties or attributes in HTML.

      This rule will check use of attributes in HTML on custom elements, as well
      as databinding into attributes and properties in polymer databinding
      contexts.

      This catches misspellings, forgetting to convert camelCase to kebab-case,
      and binding to attributes like class and style like they were properties.

      Currently only checks custom elements, as we don't yet have the necessary
      metadata on native elements in a convenient format.
  `).trim();

  constructor() {
    super();
  }

  async checkDocument(parsedDoc: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];
    // It doesn't matter right now, as there's no way to have an inline html
    // document, but this query should specify that it doesn't want to match
    // inline documents.
    const elementReferences = document.getByKind('element-reference');
    if (elementReferences.size === 0) {
      return [];
    }
    const databindingRanges =
        dom5.queryAll(parsedDoc.ast, isDatabindingTemplate)
            .map((t) => parsedDoc.sourceRangeForNode(t)!);
    for (const ref of elementReferences) {
      const node = ref.astNode;
      if (!node || !node.tagName) {
        continue;
      }
      const elements = document.getById('element', node.tagName);
      if (elements.size !== 1) {
        continue;
      }
      const element = elements.values().next().value!;

      for (const attr of node.attrs || []) {
        let name = attr.name;
        let isAttribute = true;

        // It's a databinding if it matches the regex and the reference is
        // contained within a databinding template.
        const isFullDataBinding =
            /^(({{.*}})|(\[\[.*\]\]))$/.test(attr.value) &&
            !!databindingRanges.find((r) => contains(ref.sourceRange.start, r));
        if (isFullDataBinding) {
          if (name.endsWith('$')) {
            name = name.slice(0, name.length - 1);
          } else {
            isAttribute = false;
            name = name.replace(/-(.)/g, (v) => v[1].toUpperCase());
          }
        }
        // This is an open namespace.
        if (attr.name.startsWith('data-')) {
          if (!isAttribute) {
            warnings.push({
              code: this.code,
              message: stripWhitespace(`
                  data-* attributes must be accessed as attributes.
                  i.e. you must write:  ${attr.name}$="${attr.value}"`),
              severity: Severity.ERROR,
              sourceRange:
                  parsedDoc.sourceRangeForAttributeName(node, attr.name)!
            });
          }
          continue;
        }
        if (name.startsWith('on')) {
          // TODO(https://github.com/Polymer/polymer-linter/issues/34)
          continue;
        }

        const allowedBindings: Array<Attribute|Property> =
            isAttribute ? element.attributes : element.properties;
        const shared = isAttribute ? sharedAttributes : sharedProperties;
        const found =
            shared.has(name) || !!allowedBindings.find((b) => b.name === name);
        if (!found) {
          const suggestion = closestOption(name, isAttribute, element);
          if (isFullDataBinding && suggestion.attribute) {
            suggestion.name += '$';
          }
          const bindingType = isAttribute ? 'an attribute' : 'a property';
          warnings.push({
            code: this.code,
            message: stripWhitespace(
                `${node.tagName} elements do not have ${bindingType} ` +
                `named ${name}. Consider instead:  ${suggestion.name}`),
            severity: Severity.WARNING,
            sourceRange: parsedDoc.sourceRangeForAttributeName(node, attr.name)!
          });
        }
      }
    }
    return warnings;
  }
}

function contains(position: SourcePosition, range: SourceRange) {
  return comparePositionAndRange(position, range) === 0;
}

// TODO(rictic): export this function from analyzer rather than copy-pasting it.
/**
 * If the position is inside the range, returns 0. If it comes before the range,
 * it returns -1. If it comes after the range, it returns 1.
 */
function comparePositionAndRange(
    position: SourcePosition, range: SourceRange, includeEdges?: boolean) {
  // Usually we want to include the edges of a range as part
  // of the thing, but sometimes, e.g. for start and end tags,
  // we'd rather not.
  if (includeEdges == null) {
    includeEdges = true;
  }
  if (includeEdges == null) {
    includeEdges = true;
  }
  if (position.line < range.start.line) {
    return -1;
  }
  if (position.line > range.end.line) {
    return 1;
  }
  if (position.line === range.start.line) {
    if (includeEdges) {
      if (position.column < range.start.column) {
        return -1;
      }
    } else {
      if (position.column <= range.start.column) {
        return -1;
      }
    }
  }
  if (position.line === range.end.line) {
    if (includeEdges) {
      if (position.column > range.end.column) {
        return 1;
      }
    } else {
      if (position.column >= range.end.column) {
        return 1;
      }
    }
  }
  return 0;
}

function closestOption(name: string, isAttribute: boolean, element: Element) {
  const attributeOptions = element.attributes.map((a) => a.name)
                               .concat(Array.from(sharedAttributes.keys()));
  const propertyOptions = element.properties.map((a) => a.name)
                              .concat(Array.from(sharedProperties.keys()));
  const closestAttribute =
      minBy(attributeOptions, (option) => levenshtein.get(name, option));
  const closestProperty =
      minBy(propertyOptions, (option) => levenshtein.get(name, option));
  if (closestAttribute.minScore! === closestProperty.minScore) {
    if (isAttribute) {
      return {attribute: true, name: closestAttribute.min!};
    }
    return {attribute: false, name: closestProperty.min!};
  }
  if (closestAttribute.minScore! < closestProperty.minScore!) {
    return {attribute: true, name: closestAttribute.min!};
  } else {
    return {attribute: false, name: closestProperty.min!};
  }
}

function minBy<T>(it: Iterable<T>, score: (t: T) => number) {
  let min = undefined;
  let minScore = undefined;
  for (const val of it) {
    const valScore = score(val);
    if (minScore === undefined || valScore < minScore) {
      minScore = valScore;
      min = val;
    }
  }
  return {min, minScore};
}

registry.register(new SetUnknownAttribute());
