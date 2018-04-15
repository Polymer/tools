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
import {Attribute, Document, Element, isPositionInsideRange, ParsedHtmlDocument, Property, Severity, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {sharedAttributes, sharedProperties} from '../html/util';
import {registry} from '../registry';
import {closestSpelling, stripIndentation, stripWhitespace} from '../util';

import {isDatabindingTemplate} from './matchers';


class SetUnknownAttribute extends HtmlRule {
  code = 'set-unknown-attribute';
  description = stripIndentation(`
      Warns when setting undeclared properties or attributes in HTML.

      This rule will check use of attributes in HTML on custom elements, as well
      as databinding into attributes and properties in polymer databinding
      contexts.

      This catches misspellings, forgetting to convert camelCase to kebab-case,
      and binding to attributes like class and style like they were properties.

      Currently only checks custom elements, as we don't yet have the necessary
      metadata on native elements in a convenient format.
  `);

  async checkDocument(parsedDoc: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];
    // It doesn't matter right now, as there's no way to have an inline html
    // document, but this query should specify that it doesn't want to match
    // inline documents.
    const elementReferences = document.getFeatures({kind: 'element-reference'});
    if (elementReferences.size === 0) {
      return [];
    }
    const databindingRanges =
        [...dom5.queryAll(parsedDoc.ast, isDatabindingTemplate)].map(
            (t) => parsedDoc.sourceRangeForNode(t)!);
    for (const ref of elementReferences) {
      const node = ref.astNode.node;
      if (!node || !node.tagName) {
        continue;
      }
      const elements = document.getFeatures({
        kind: 'element',
        id: node.tagName,
        imported: true,
        externalPackages: true
      });
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
            !!databindingRanges.find(
                (r) => isPositionInsideRange(ref.sourceRange.start, r));
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
            warnings.push(new Warning({
              parsedDocument: parsedDoc,
              code: this.code,
              message: stripWhitespace(`
                  data-* attributes must be accessed as attributes.
                  i.e. you must write:  ${attr.name}$="${attr.value}"`),
              severity: Severity.ERROR,
              sourceRange:
                  parsedDoc.sourceRangeForAttributeName(node, attr.name)!
            }));
          }
          continue;
        }
        if (name.startsWith('on')) {
          // TODO(https://github.com/Polymer/polymer-linter/issues/34)
          continue;
        }

        const allowedBindings: Array<Attribute|Property> = isAttribute ?
            [...element.attributes.values()] :
            [...element.properties.values()];
        const shared = isAttribute ? sharedAttributes : sharedProperties;
        const found =
            shared.has(name) || !!allowedBindings.find((b) => b.name === name);
        // This works for both attributes and properties, but warning for
        // unknown attributes is too noisy for most, and it has lots of totally
        // legitimate uses.
        // TODO(rictic): once we've got per-rule settings piped in, checking
        //     attributes  should be an option. Maybe also as part of a
        //     strict databinding collection?
        if (!found && !isAttribute) {
          const suggestion = closestOption(name, isAttribute, element);
          if (isFullDataBinding && suggestion.attribute) {
            suggestion.name += '$';
          }
          const bindingType = isAttribute ? 'an attribute' : 'a property';
          warnings.push(new Warning({
            parsedDocument: parsedDoc,
            code: this.code,
            message: stripWhitespace(
                `${node.tagName} elements do not have ${bindingType} ` +
                `named ${name}. Consider instead:  ${suggestion.name}`),
            severity: Severity.WARNING,
            sourceRange: parsedDoc.sourceRangeForAttributeName(node, attr.name)!
          }));
        }
      }
    }
    return warnings;
  }
}

function closestOption(name: string, isAttribute: boolean, element: Element) {
  const attributeOptions =
      [...element.attributes.keys(), ...sharedAttributes.keys()];
  const propertyOptions =
      [...element.properties.keys(), ...sharedProperties.keys()];
  const closestAttribute = closestSpelling(name, attributeOptions)!;
  const closestProperty = closestSpelling(name, propertyOptions)!;
  if (closestAttribute.minScore! === closestProperty.minScore) {
    if (isAttribute) {
      return {attribute: true, name: closestAttribute.min};
    }
    return {attribute: false, name: closestProperty.min};
  }
  if (closestAttribute.minScore! < closestProperty.minScore!) {
    return {attribute: true, name: closestAttribute.min};
  } else {
    return {attribute: false, name: closestProperty.min};
  }
}


registry.register(new SetUnknownAttribute());
