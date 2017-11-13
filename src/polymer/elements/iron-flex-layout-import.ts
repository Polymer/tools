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
import {Document, ParsedHtmlDocument, Severity} from 'polymer-analyzer';

import {HtmlRule} from '../../html/rule';
import {getIndentationInside, insertContentAfter, removeNode} from '../../html/util';
import {registry} from '../../registry';
import {stripIndentation} from '../../util';
import {FixableWarning, Replacement} from '../../warning';

// Capture any import file in the `classes` folder.
const deprecatedImports = /iron-flex-layout\/classes\/.*/;
const replacementImport = 'iron-flex-layout/iron-flex-layout-classes.html';
const polymerLikeImport = /(iron|paper|app)-.*\/(iron|paper|app)-.*\.html$/;

const p = dom5.predicates;

const isImport = p.AND(
    p.hasTagName('link'), p.hasAttrValue('rel', 'import'), p.hasAttr('href'));

const styleModulesRegex = /iron-(flex|positioning)/;
const usesIronFlexStyleIncludes = p.AND(
    p.hasTagName('style'),
    p.hasAttr('include'),
    (node: dom5.Node) =>
        styleModulesRegex.test(dom5.getAttribute(node, 'include')!));

class IronFlexLayoutImport extends HtmlRule {
  code = 'iron-flex-layout-import';
  description = stripIndentation(`
      Warns when the deprecated iron-flex-layout/classes/*.html files are imported.

      This:

          <link rel="import" href="../iron-flex-layout/classes/iron-flex-layout.html">
          <link rel="import" href="../iron-flex-layout/classes/iron-shadow-flex-layout.html">

      Should instead be written as:

          <link rel="import" href="../iron-flex-layout/iron-flex-layout-classes.html">
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document) {
    const warnings: FixableWarning[] = [];

    this.convertDeclarations(parsedDocument, document, warnings);

    return warnings;
  }

  convertDeclarations(
      parsedDocument: ParsedHtmlDocument, _: Document,
      warnings: FixableWarning[]) {
    const imports = dom5.queryAll(parsedDocument.ast, isImport);
    // Assume base path to be current folder.
    let polymerElementsBasePath: string = './';
    let goodImport: dom5.Node|null = null;
    const badImports: dom5.Node[] = [];
    for (const imp of imports) {
      const href = dom5.getAttribute(imp, 'href')!;
      if (href.endsWith(replacementImport)) {
        goodImport = imp;
      } else if (deprecatedImports.test(href)) {
        badImports.push(imp);
      }
      if (polymerLikeImport.test(href)) {
        polymerElementsBasePath = href.replace(polymerLikeImport, '');
      }
    }

    const styleNode = dom5.query(
        parsedDocument.ast,
        usesIronFlexStyleIncludes,
        dom5.childNodesIncludeTemplate);
    // Style modules are used, but not imported!
    if (!badImports.length && !goodImport && styleNode) {
      const warning = new FixableWarning({
        code: 'iron-flex-layout-import',
        message: `iron-flex-layout style modules are used but not imported.
Import iron-flex-layout/iron-flex-layout-classes.html`,
        parsedDocument,
        severity: Severity.WARNING,
        sourceRange:
            parsedDocument.sourceRangeForAttributeValue(styleNode, 'include')!
      });
      const correctImport = polymerElementsBasePath + replacementImport;
      if (imports.length) {
        const lastImport = imports[imports.length - 1];
        const indent = getIndentationInside(lastImport.parentNode!);
        warning.fix = [insertContentAfter(parsedDocument, lastImport, `
${indent}<link rel="import" href="${correctImport}">`)];
      } else {
        // If no imports present, assume we are in a file with only
        // <dom-module>s as it doesn't make sense to be in a entry-point
        // document w/o imports.
        const range = {
          file: parsedDocument.sourceRangeForStartTag(styleNode)!.file,
          start: {line: 0, column: 0},
          end: {line: 0, column: 0}
        };
        const replacementText = `<link rel="import" href="${correctImport}">\n`;
        warning.fix = [{replacementText, range}];
      }
      warnings.push(warning);
    }
    // If there is a good import that is not used, remove it.
    if (!styleNode && goodImport) {
      const warning = new FixableWarning({
        code: 'iron-flex-layout-import',
        message:
            `This import defines style modules that are not being used. It can be removed.`,
        parsedDocument,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForStartTag(goodImport)!
      });
      warning.fix = removeNode(parsedDocument, goodImport);
      warnings.push(warning);
    }
    // If there are bad imports, ensure they're either fixed or removed.
    badImports.forEach((imp, i) => {
      const href = dom5.getAttribute(imp, 'href')!;
      const correctImport = href.replace(deprecatedImports, replacementImport);
      const suggestedFix = styleNode ?
          `Replace it with ${correctImport} import.` :
          'Remove it as it is not used.';
      const warning = new FixableWarning({
        code: 'iron-flex-layout-import',
        message: `${href} import is deprecated in iron-flex-layout v1, ` +
            `and not shipped in iron-flex-layout v2.
${suggestedFix}
Run the lint rule \`iron-flex-layout-classes\` with \`--fix\` to include the required style modules.`,
        parsedDocument,
        severity: Severity.WARNING,
        sourceRange: parsedDocument.sourceRangeForAttributeValue(imp, 'href')!
      });
      const fix: Replacement[] = [];
      if (!styleNode || goodImport || i > 0) {
        fix.push(...removeNode(parsedDocument, imp));
      } else {
        fix.push({
          replacementText: `"${correctImport}"`,
          range: parsedDocument.sourceRangeForAttributeValue(imp, 'href')!
        });
      }
      warning.fix = fix;
      warnings.push(warning);
    });
  }
}

registry.register(new IronFlexLayoutImport());
