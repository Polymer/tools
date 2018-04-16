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
import {comparePositionAndRange, Document, DomModule, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {HtmlRule} from '../html/rule';
import {registry} from '../registry';
import {stripIndentation} from '../util';

/**
 * Unbalanced binding expression delimiters occurs when a value such as
 * `[[myValue]]` or `{{myValue}}` have too many or too few brackets on either
 * side.
 */
class ElementBeforeDomModule extends HtmlRule {
  readonly code = 'element-before-dom-module';
  readonly description = stripIndentation(`
      Warns for an element being declared before its dom-module.

      For example, this is invalid:
        <script>Polymer({is: 'my-elem'})</script>
        <dom-module id='my-elem'></dom-module>

      But this is fine:
        <dom-module id='my-elem'></dom-module>
        <script>Polymer({is: 'my-elem'})</script>
  `);

  public async checkDocument(
      parsedHtml: ParsedHtmlDocument, document: Document): Promise<Warning[]> {
    const warnings: Warning[] = [];

    const domModules = document.getFeatures({kind: 'dom-module'});
    if (domModules.size === 0) {
      return warnings;  // Early exit quick in the trivial case.
    }
    const domModulesByTagName = new Map<string, DomModule>();
    for (const domModule of domModules) {
      if (!domModule.id) {
        continue;
      }
      domModulesByTagName.set(domModule.id, domModule);
    }

    // Gather together all elements defined in this file and in direct imports.
    // Group them together with the source range in this file that they first
    // become active. (We don't look into transitive imports because circularity
    // makes ordering complicated.)
    const localElements =
        Array.from(document.getFeatures({kind: 'polymer-element'}))
            .filter((el) => !!el.sourceRange)
            .map((el) => ({sourceRange: el.sourceRange!, elements: [el]}));
    const elementsByImport =
        Array.from(document.getFeatures({kind: 'import'}))
            .filter((i) => i.sourceRange)
            .map((i) => {
              if (!i.document) {
                return undefined!;
              }
              // For complicated reasons, non-module script src tags are kinda
              // treated like independent documents, and kinda like inline
              // scripts. Long story short, we need to make sure that any
              // elements defined "in them" aren't actually defined in us, their
              // importer.
              const elements =
                  Array.from(i.document.getFeatures({kind: 'polymer-element'}));
              const nonlocalElements = elements.filter(
                  (e) => e.sourceRange && e.sourceRange.file !== document.url);
              return {sourceRange: i.sourceRange!, elements: nonlocalElements};
            })
            .filter((v) => !!v);

    // Sort the element groups by the order in which they appear in the
    // document.
    const sorted = localElements.concat(elementsByImport).sort((a, b) => {
      return comparePositionAndRange(a.sourceRange.start, b.sourceRange);
    });

    const seenSoFar = new Set<string>();
    for (const pair of sorted) {
      for (const element of pair.elements) {
        const tagName = element.tagName;
        if (!tagName) {
          continue;
        }
        const domModule = domModulesByTagName.get(tagName);
        if (!domModule || seenSoFar.has(tagName)) {
          continue;
        }
        seenSoFar.add(tagName);

        // Ok! Finally! domModule is a <dom-module> from `document`, and
        // `element` is its element definition, first defined at
        // `pair.sourceRange` in `document`. Now we compare them, and if the
        // element comes before the dom-module, that's an error!
        if (comparePositionAndRange(
                pair.sourceRange.start, domModule.sourceRange) === -1) {
          // TODO(rictic): if we ever support multiple source ranges on
          //     warnings, this would be a good candidate.
          warnings.push(new Warning({
            parsedDocument: parsedHtml,
            code: this.code,
            message: `A Polymer element must be defined after its ` +
                `\`<dom-module>\`. If it can't find its \`<dom-module>\` ` +
                `when it is registered, it will assume it does not have one.`,
            severity: Severity.ERROR,
            sourceRange:
                parsedHtml.sourceRangeForStartTag(domModule.astNode.node) ||
                domModule.sourceRange,
          }));
        }
      }
    }

    return warnings;
  }
}


registry.register(new ElementBeforeDomModule());
