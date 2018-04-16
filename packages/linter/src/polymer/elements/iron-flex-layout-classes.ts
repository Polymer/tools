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
import {Document, Edit, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../../html/rule';
import {addAttribute, elementSelectorToPredicate, getIndentationInside, prependContentInto} from '../../html/util';
import {registry} from '../../registry';
import {stripIndentation} from '../../util';

const p = dom5.predicates;

const styleModules = [
  {
    module: 'iron-flex',
    selector: elementSelectorToPredicate(
        '.layout.horizontal, .layout.vertical, .layout.inline, .layout.wrap,' +
            '.layout.no-wrap, .layout.center, .layout.center-center, ' +
            '.layout.center-justified, .flex, .flex-auto, .flex-none',
        true)
  },
  {
    module: 'iron-flex-reverse',
    selector: elementSelectorToPredicate(
        '.layout.horizontal-reverse, .layout.vertical-reverse, ' +
            '.layout.wrap-reverse',
        true)
  },
  {
    module: 'iron-flex-alignment',
    // Skip `.layout.center, .layout.center-center, .layout.center-justified`
    // as they're already defined in the `iron-flex` module.
    selector: elementSelectorToPredicate(
        '.layout.start, .layout.end, .layout.baseline, .layout.start-justified, ' +
            '.layout.end-justified, .layout.around-justified, .layout.justified, ' +
            '.self-start, .self-center, .self-end, .self-stretch, .self-baseline, ' +
            '.layout.start-aligned, .layout.end-aligned, .layout.center-aligned, ' +
            '.layout.between-aligned, .layout.around-aligned',
        true)
  },
  {
    module: 'iron-flex-factors',
    // Skip `.flex` as it's already defined in the `iron-flex` module.
    selector: elementSelectorToPredicate(
        '.flex-1, .flex-2, .flex-3, .flex-4, .flex-5, .flex-6, .flex-7, ' +
            '.flex-8, .flex-9, .flex-10, .flex-11, .flex-12',
        true)
  },
  {
    module: 'iron-positioning',
    // Skip `[hidden]` as it's a too generic selector.
    selector: elementSelectorToPredicate(
        '.block, .invisible, .relative, .fit, body.fullbleed, ' +
            '.scroll, .fixed-bottom, .fixed-left, .fixed-top, .fixed-right',
        true)
  }
];

const styleModulesRegex = /iron-(flex|positioning)/;

const isStyleInclude = p.AND(p.hasTagName('style'), p.hasAttr('include'));

class IronFlexLayoutClasses extends HtmlRule {
  code = 'iron-flex-layout-classes';
  description = stripIndentation(`
      Warns when iron-flex-layout classes are used without including the style modules.

      This:

          <link rel="import" href="../iron-flex-layout/iron-flex-layout-classes.html">
          <dom-module>
            <template>
              <style>
                :host { diplay: block; }
              </style>
              <div class="layout vertical">hello</div>
            </template>
          <dom-module>

      Should instead be written as:

          <link rel="import" href="../iron-flex-layout/iron-flex-layout-classes.html">
          <dom-module>
            <template>
              <style include="iron-flex">
                :host { diplay: block; }
              </style>
              <div class="layout vertical">hello</div>
            </template>
          <dom-module>
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: Warning[] = [];

    // Search in the dom-modules.
    for (const domModule of document.getFeatures({kind: 'dom-module'})) {
      const misplacedStyle =
          dom5.query(domModule.astNode.node, p.hasTagName('style'));
      if (misplacedStyle) {
        warnings.push(new Warning({
          code: 'iron-flex-layout-classes',
          message:
              `Style outside template. Run \`move-style-into-template\` rule.`,
          parsedDocument,
          severity: Severity.ERROR,
          sourceRange: parsedDocument.sourceRangeForStartTag(misplacedStyle)!
        }));
        continue;
      }
      const template =
          dom5.query(domModule.astNode.node, p.hasTagName('template'));
      if (!template) {
        continue;
      }
      const templateContent = treeAdapters.default.getTemplateContent(template);
      const fixIndex = warnings.length;
      const missingModules =
          getMissingStyleModules(parsedDocument, templateContent, warnings);
      if (!missingModules) {
        continue;
      }
      // Add fix on first warning, we'll add all the missing modules in the same
      // style node.
      // TODO: we should not mutate warning.fix like this.
      const warning: {fix: Edit | undefined} = warnings[fixIndex];
      // Fallback to style without include attribute.
      const styleNode = getStyleNodeWithInclude(templateContent) ||
          dom5.query(templateContent, p.hasTagName('style'));
      if (!styleNode) {
        const indent = getIndentationInside(templateContent);
        warning.fix = [prependContentInto(parsedDocument, template, `
${indent}<style include="${missingModules}"></style>`)];
      } else if (dom5.hasAttribute(styleNode, 'include')) {
        const include = dom5.getAttribute(styleNode, 'include')!;
        warning.fix = [{
          replacementText: `"${include} ${missingModules}"`,
          range:
              parsedDocument.sourceRangeForAttributeValue(styleNode, 'include')!
        }];
      } else {
        warning.fix = [addAttribute(
            parsedDocument, styleNode, 'include', missingModules)];
      }
    }
    const body = dom5.query(parsedDocument.ast, p.hasTagName('body'));
    // Handle files like `<dom-module></dom-module> <body><p>hello</p></body>`
    // where a "fake" body node would be created by dom-module. Skip these
    // cases, dear user please write proper HTML ¯\_(ツ)_/¯
    if (!body || !body.__location) {
      return warnings;
    }
    const fixIndex = warnings.length;
    const missingModules =
        getMissingStyleModules(parsedDocument, parsedDocument.ast, warnings);
    if (!missingModules) {
      return warnings;
    }
    // Add fix on first warning, we'll add all the missing modules in the same
    // style node.
    const warning: {fix: Edit | undefined} = warnings[fixIndex];
    const styleNode = getStyleNodeWithInclude(parsedDocument.ast);
    if (styleNode) {
      const include = dom5.getAttribute(styleNode, 'include')!;
      warning.fix = [{
        replacementText: `"${include} ${missingModules}"`,
        range:
            parsedDocument.sourceRangeForAttributeValue(styleNode, 'include')!
      }];
    } else {
      const indent = getIndentationInside(body);
      warning.fix = [prependContentInto(parsedDocument, body, `
${indent}<custom-style>
${indent}  <style is="custom-style" include="${missingModules}"></style>
${indent}</custom-style>`)];
    }

    return warnings;
  }
}

function getMissingStyleModules(
    parsedDocument: ParsedHtmlDocument,
    rootNode: dom5.Node,
    warnings: Warning[]): string {
  const {modules, includes} = searchUsedModulesAndIncludes(rootNode);
  let missingModules = '';
  for (const [module, nodes] of modules) {
    if (includes.indexOf(module) === -1) {
      warnings.push(...nodes.map(
          (node: dom5.Node) => new Warning({
            code: 'iron-flex-layout-classes',
            message: `"${module}" style module is used but not imported.
Import it in the template style include.`,
            parsedDocument,
            severity: Severity.WARNING,
            // Prefer warning on class$, as it will override any value of class.
            sourceRange: parsedDocument.sourceRangeForAttributeValue(
                node, `class${dom5.hasAttribute(node, 'class$') ? '$' : ''}`)!
          })));
      missingModules += ' ' + module;
    }
  }
  return missingModules.trim();
}

function searchUsedModulesAndIncludes(
    rootNode: dom5.Node,
    modules: Map<string, dom5.Node[]> = new Map(),
    includes: string[] =
        []): {modules: Map<string, dom5.Node[]>, includes: string[]} {
  for (const node of dom5.depthFirst(rootNode)) {
    if (!dom5.isElement(node)) {
      continue;
    }
    // Ensure we don't search into dom-module's templates.
    if (p.hasTagName('template')(node) &&
        !p.hasTagName('dom-module')(node.parentNode!)) {
      const templateContent = treeAdapters.default.getTemplateContent(node);
      searchUsedModulesAndIncludes(templateContent, modules, includes);
    } else if (isStyleInclude(node)) {
      dom5.getAttribute(node, 'include')!.split(' ').forEach((include) => {
        if (includes.indexOf(include) === -1) {
          includes.push(include);
        }
      });
    } else {
      styleModules.forEach((m) => {
        if (m.selector(node)) {
          if (!modules.has(m.module)) {
            modules.set(m.module, [node]);
          } else {
            modules.get(m.module)!.push(node);
          }
        }
      });
    }
  }
  return {modules, includes};
}

function getStyleNodeWithInclude(node: dom5.Node) {
  let styleToEdit = null;
  for (const style of dom5.queryAll(node, isStyleInclude)) {
    // Get the first one of the styles with include attribute, otherwise
    // prefer styles that already include iron-flex-layout modules.
    if (!styleToEdit ||
        styleModulesRegex.test(dom5.getAttribute(style, 'include')!)) {
      styleToEdit = style;
    }
  }
  return styleToEdit;
}

registry.register(new IronFlexLayoutClasses());
