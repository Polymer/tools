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

import {Analyzer, Warning, WarningPrinter} from 'polymer-analyzer';

export class WarningPrettyPrinter {
  private _printer: WarningPrinter;
  constructor(analyzer: Analyzer) {
    this._printer = new WarningPrinter(null as any, {analyzer});
  }

  async prettyPrint(warnings: Warning[]): Promise<string[]> {
    return Promise.all(warnings.map(
        async(w) =>
            '\n' + await this._printer.getUnderlinedText(w.sourceRange)));
  }
}
