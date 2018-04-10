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

import {Document, ParsedCssDocument, Warning} from 'polymer-analyzer';

import {Rule} from '../rule';

/**
 * An abstract rule that operates only over CSS files.
 */
export abstract class CssRule extends Rule {
  async check(document: Document): Promise<Warning[]> {
    const warnings = [];
    const cssDocuments =
        document.getFeatures({kind: 'css-document', imported: false});
    for (const cssDocument of cssDocuments) {
      if (!(cssDocument.parsedDocument instanceof ParsedCssDocument)) {
        continue;
      }
      warnings.push(
          ...await this.checkDocument(cssDocument.parsedDocument, cssDocument));
    }
    return warnings;
  }

  /**
   * Implement this method, rather than the `check` method.
   */
  abstract checkDocument(parsedDocument: ParsedCssDocument, document: Document):
      Promise<Warning[]>;
}
