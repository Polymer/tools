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

import {Severity, Warning} from '../model/model';

import minimatch = require('minimatch');
import {IMinimatch} from 'minimatch';

export interface Options {
  /**
   * Warning codes like 'parse-error' or 'behavior-not-found' to filter out.
   */
  warningCodesToIgnore?: ReadonlySet<string>;
  /**
   * All warnings below this level of severity will be filtered out.
   */
  minimumSeverity: Severity;

  /**
   * Any file whose URL matches one of these minimatch globs will be ignored.
   */
  filesToIgnore?: ReadonlyArray<string>;
}

export class WarningFilter {
  warningCodesToIgnore: ReadonlySet<string> = new Set<string>();
  minimumSeverity = Severity.INFO;
  fileGlobsToFilterOut: ReadonlyArray<IMinimatch> = [];

  constructor(options: Options) {
    if (options.warningCodesToIgnore) {
      this.warningCodesToIgnore = options.warningCodesToIgnore;
    }
    if (options.minimumSeverity != null) {
      this.minimumSeverity = options.minimumSeverity;
    }
    if (options.filesToIgnore) {
      this.fileGlobsToFilterOut =
          (options.filesToIgnore ||
           []).map((glob) => new minimatch.Minimatch(glob, {}));
    }
  }

  shouldIgnore(warning: Warning) {
    if (this.warningCodesToIgnore.has(warning.code)) {
      return true;
    }
    if (warning.severity > this.minimumSeverity) {
      return true;
    }
    for (const glob of this.fileGlobsToFilterOut) {
      if (glob.match(warning.sourceRange.file)) {
        return true;
      }
    }
    return false;
  }
}
