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
import * as parse5 from 'parse5';
import {Document, isPositionInsideRange, ParsedCssDocument, ParsedHtmlDocument, Replacement, Severity, Warning} from 'polymer-analyzer';
import * as shady from 'shady-css-parser';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {getDocumentContaining, stripIndentation, stripWhitespace} from '../util';

const p = dom5.predicates;
const isCustomStyle = p.AND(
    p.hasTagName('style'),
    p.OR(
        p.hasAttrValue('is', 'custom-style'),
        (node: dom5.Node) => !!(
            node.parentNode && p.hasTagName('custom-style')(node.parentNode))));

class RootSelectorToHtml extends HtmlRule {
  code = 'root-selector-to-html';
  description = stripIndentation(`
      Warns when using :root inside an element's template, custom-style, or style module.
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const elementStyleTags: dom5.Node[] = [];
    const styleModuleStyleTags: dom5.Node[] = [];

    // Get custom-styles
    const customStyleTags = [...dom5.queryAll(
        parsedDocument.ast, isCustomStyle, dom5.childNodesIncludeTemplate)];

    // Get dom-modules then sort style tags into element styles or style module
    // styles
    const domModules = document.getFeatures({kind: 'dom-module'});
    if (domModules.size > 0) {
      for (const domModule of domModules) {
        const moduleChildren = domModule.astNode.node.childNodes || [];
        type TemplateElement = parse5.ASTNode&{content: parse5.ASTNode};
        const template = moduleChildren.find(
            (m) => m.tagName === 'template') as TemplateElement;
        if (template === undefined ||
            template.content.childNodes === undefined ||
            template.content.childNodes.length === 0) {
          continue;
        }
        const styleTag = template.content.childNodes.find(
            (t: dom5.Node) => t.tagName === 'style');
        if (styleTag === undefined) {
          continue;
        }

        const elements = document.getFeatures({kind: 'polymer-element'});
        const isElementModule = [...elements].some(
            (el) =>
                !!(el.sourceRange &&
                   isPositionInsideRange(
                       el.sourceRange.start, domModule.sourceRange)));
        if (isElementModule) {
          elementStyleTags.push(styleTag);
        } else {
          styleModuleStyleTags.push(styleTag);
        }
      }
    }

    return [
      ...this.generateWarnings(
          document, customStyleTags, 'html'),  // Check custom styles
      ...this.generateWarnings(
          document, elementStyleTags, ':host > *'),  // Check element styles
      ...this.generateWarnings(
          document,
          styleModuleStyleTags,
          'html, :host > *'),  // Check style modules
    ];
  }

  private generateWarnings(
      document: Document, styleTags: dom5.Node[], replacementText: string) {
    const warnings: Warning[] = [];
    if (styleTags.length === 0) {
      return warnings;
    }

    for (const style of styleTags) {
      const sourceRange = document.parsedDocument.sourceRangeForNode(
          style.childNodes && style.childNodes[0]);
      if (sourceRange === undefined) {
        continue;
      }
      const containingDoc =
          getDocumentContaining(sourceRange, document) as ParsedCssDocument;
      if (containingDoc === undefined) {
        continue;
      }

      for (const node of containingDoc) {
        if (node.type !== shady.nodeType.ruleset) {
          continue;
        }

        const deprecatedRegex = /:root/;
        const match = node.selector.match(deprecatedRegex);
        if (match === null) {
          continue;
        }

        const start = node.range.start + match.index!;
        const sourceRange = containingDoc.sourceRangeForShadyRange(
            {start, end: start + match[0].length});

        // Only fix plain `:root` selectors
        let fix: Replacement[]|undefined = undefined;
        if (/^:root$/.test(node.selector)) {
          fix = [{range: sourceRange, replacementText}];
        }

        warnings.push(new Warning({
          parsedDocument: document.parsedDocument,
          code: this.code,
          severity: Severity.WARNING, sourceRange,
          message: stripWhitespace(`
            The ::root selector should no longer be used
          `),
          fix
        }));
      }
    }

    return warnings;
  }
}

registry.register(new RootSelectorToHtml());
