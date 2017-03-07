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
import {ParsedHtmlDocument, Warning, Severity} from 'polymer-analyzer';
import stripIndent = require('strip-indent');
import {stripWhitespace} from '../util';
import {HtmlRule} from './rule';
import {registry} from '../registry';

const p = dom5.predicates;

export class DomModuleNameOrIs extends HtmlRule {
  code = 'dom-module-invalid-attrs';
  description = stripIndent(`
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
  constructor() {
    super();
  }

  async checkDocument(document: ParsedHtmlDocument) {
    const warnings: Warning[] = [];
    const badModule = p.AND(
        p.hasTagName('dom-module'), p.OR(p.hasAttr('is'), p.hasAttr('name')));
    const badModules = dom5.nodeWalkAll(document.ast, badModule);
    for (const domModule of badModules) {
      for (const badAttr of ['is', 'name']) {
        const attr = dom5.getAttribute(domModule, badAttr);
        if (attr != null) {
          warnings.push({
            code: this.code,
            message: stripWhitespace(`
                Use the "id" attribute rather than "${badAttr}"
                to associate the tagName of an element with its dom-module.`),
            severity: Severity.WARNING,
            sourceRange:
                document.sourceRangeForAttributeName(domModule, badAttr)!
          });
        }
      }
    }
    return warnings;
  }
}

registry.register(new DomModuleNameOrIs());
