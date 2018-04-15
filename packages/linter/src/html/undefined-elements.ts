/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import {Document, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';

import {registry} from '../registry';
import {stripIndentation} from '../util';

import {HtmlRule} from './rule';


class UndefinedElements extends HtmlRule {
  code = 'undefined-elements';
  description = stripIndentation(`
    Warns when an HTML tag refers to a custom element with no known definition.
  `);

  async checkDocument(parsedDocument: ParsedHtmlDocument, document: Document):
      Promise<Warning[]> {
    const warnings: Warning[] = [];

    const refs = document.getFeatures({kind: 'element-reference'});

    for (const ref of refs) {
      if (ref.tagName === 'test-fixture') {
        // HACK. Filed as https://github.com/Polymer/polymer-analyzer/issues/507
        continue;
      }
      // TODO(rictic): ASTNodes should always exist for element references, and
      //   it should always be possible to get their start tags, but we saw some
      //   errors where the source range was undefined. Needs investigation.
      if (!ref.astNode) {
        continue;
      }
      const el = document.getFeatures({
        kind: 'element',
        id: ref.tagName,
        imported: true,
        externalPackages: true
      });

      if (el.size === 0) {
        const sourceRange =
            parsedDocument.sourceRangeForStartTag(ref.astNode.node);
        if (!sourceRange) {
          continue;
        }
        warnings.push(new Warning({
          parsedDocument,
          code: 'undefined-elements',
          message: `The element ${ref.tagName} is not defined`,
          severity: Severity.WARNING, sourceRange
        }));
      }
    }

    return warnings;
  }
}

registry.register(new UndefinedElements());
