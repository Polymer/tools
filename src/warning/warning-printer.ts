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

import * as chalk from 'chalk';

import {Warning} from '../model/model';

export type Verbosity = 'one-line'|'full';

export interface Options {
  verbosity?: Verbosity;
  color?: boolean;
}

const defaultPrinterOptions = {
  verbosity: 'full' as 'full',
  color: true
};

export class WarningPrinter {
  _chalk: chalk.Chalk;
  private _options: Options;

  constructor(private _outStream: NodeJS.WritableStream, options?: Options) {
    this._options = {...defaultPrinterOptions, ...options};
    this._chalk = new chalk.constructor({enabled: !!this._options.color});
  }

  /**
   * Convenience method around `printWarning`.
   */
  async printWarnings(warnings: Iterable<Warning>) {
    for (const warning of warnings) {
      if (this._options.verbosity === 'full') {
        this._outStream.write('\n\n');
      }
      this._outStream.write(warning.toString(this._options));
    }
  }
}
