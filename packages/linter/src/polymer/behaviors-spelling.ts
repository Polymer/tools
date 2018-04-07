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

import {Document, Severity, Warning} from 'polymer-analyzer';

import {registry} from '../registry';
import {Rule} from '../rule';
import {stripIndentation, stripWhitespace} from '../util';

class BehaviorsSpelling extends Rule {
  code = 'behaviors-spelling';
  description = stripIndentation(`
      Warns when the Polymer \`behaviors\` property is spelled \`behaviours\`,
      as Polymer uses the American spelling.

          Polymer({
            behaviours: [...]
          });

      Accepted syntax:

          Polymer({
            behaviors: [...]
          });
  `);

  async check(document: Document) {
    const warnings: Warning[] = [];
    const elements = document.getFeatures({kind: 'polymer-element'});

    for (const element of elements) {
      const behavioursProperty = element.properties.get('behaviours');

      if (behavioursProperty && !behavioursProperty.published &&
          behavioursProperty.sourceRange) {
        warnings.push(new Warning({
          parsedDocument: document.parsedDocument,
          code: this.code,
          message: stripWhitespace(`
              "behaviours" property should be spelled "behaviors"`),
          severity: Severity.WARNING,
          sourceRange: behavioursProperty.sourceRange
        }));
      }
    }
    return warnings;
  }
}

registry.register(new BehaviorsSpelling());
