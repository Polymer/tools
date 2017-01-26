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

import {Document} from 'polymer-analyzer/lib/model/document';
import {Warning} from 'polymer-analyzer/lib/warning/warning';

/**
 * A lint rule. Can take a package and find Warnings.
 */
export abstract class Rule {
  /**
   * A unique identifier for this lint rule, like "move-style-into-template".
   */
  abstract code: string;

  /**
   * A description of the operation of this upgrade pass. Like "Moves style
   * children of dom-modules into their templates."
   */
  abstract description: string;

  /**
   * Finds all warnings in the given document.
   */
  abstract check(document: Document): Promise<Warning[]>;
}
