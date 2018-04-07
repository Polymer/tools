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
import {ParsedHtmlDocument, Replacement, Severity, Warning} from 'polymer-analyzer';

import {registry} from '../registry';
import {stripIndentation, stripWhitespace} from '../util';

import {HtmlRule} from './rule';

const p = dom5.predicates;

class DomModuleInvalidAttrs extends HtmlRule {
  code = 'dom-module-invalid-attrs';
  description = stripIndentation(`
      Warns for:

          <dom-module name="foo-elem">
          </dom-module>

      or

          <dom-module is="foo-elem">
          </dom-module>

      Correct syntax:

          <dom-module id="foo-elem">
          </dom-module>
  `);

  async checkDocument(document: ParsedHtmlDocument) {
    const warnings: Warning[] = [];
    const badModule = p.AND(
        p.hasTagName('dom-module'), p.OR(p.hasAttr('is'), p.hasAttr('name')));
    const badModules = dom5.queryAll(document.ast, badModule);
    for (const domModule of badModules) {
      const isFixable =
          !(dom5.getAttribute(domModule, 'is') !== null &&
            dom5.getAttribute(domModule, 'name') !== null);
      for (const badAttr of ['is', 'name']) {
        const attr = dom5.getAttribute(domModule, badAttr);
        if (attr === null) {
          continue;
        }

        const sourceRange =
            document.sourceRangeForAttributeName(domModule, badAttr);
        if (sourceRange === undefined) {
          continue;
        }

        let fix: ReadonlyArray<Replacement>|undefined;
        if (isFixable) {
          fix = [
            {
              range: sourceRange,
              replacementText: 'id',
            },
          ];
        }

        warnings.push(new Warning({
          parsedDocument: document,
          code: this.code,
          message: stripWhitespace(`
              Use the "id" attribute rather than "${badAttr}"
              to associate the tagName of an element with its dom-module.`),
          severity: Severity.WARNING, sourceRange, fix,
        }));
      }
    }
    return warnings;
  }
}

registry.register(new DomModuleInvalidAttrs());
