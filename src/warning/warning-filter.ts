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

import {Severity, Warning} from './warning';


export interface Options {
  /**
   * Warning codes like 'parse-error' or 'behavior-not-found' to filter out.
   */
  warningCodesToIgnore?: Set<string>;
  /**
   * All warnings below this level of severity will be filtered out.
   */
  minimumSeverity: Severity;
}

export class WarningFilter {
  warningCodesToIgnore = new Set<string>();
  minimumSeverity = Severity.INFO;

  constructor(_options: Options) {
    if (_options.warningCodesToIgnore) {
      this.warningCodesToIgnore = _options.warningCodesToIgnore;
    }
    if (_options.minimumSeverity != null) {
      this.minimumSeverity = _options.minimumSeverity;
    }
  }

  shouldIgnore(warning: Warning) {
    if (this.warningCodesToIgnore.has(warning.code)) {
      return true;
    }
    if (warning.severity > this.minimumSeverity) {
      return true;
    }
    return false;
  }
}
