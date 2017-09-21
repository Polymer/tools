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

import * as fs from 'fs';
import * as pad from 'pad';
import * as ProgressBar from 'progress';

// TODO(usergenic): import doesn't seem to work for escape-string-regexp.
const escapeStringRegexp = require('escape-string-regexp');

// TODO(usergenic): Replace magic numbers with configurable or
// viewport-dimension-derived values.
const progressMessageWidth = 40;
const progressBarWidth = 45;

/**
 * Synchronously determines whether the given file exists.
 */
export function existsSync(fn: string): boolean {
  return safeStatSync(fn) !== undefined;
}

/**
 * Synchronously determines whether the given file exists.
 */
export function isDirSync(fn: string): boolean {
  const stats = safeStatSync(fn);
  if (stats === undefined) {
    return false;
  }
  return stats.isDirectory();
}

/**
 * Synchronously determines whether the given file exists.
 */
export function safeStatSync(fn: string): fs.Stats|undefined {
  try {
    return fs.statSync(fn);
  } catch (_) {
    return undefined;
  }
}

/**
 * Like Promise.all, but also displays a progress bar that fills as the
 * promises resolve. The label is a helpful string describing the operation
 * that the user is waiting on.
 */
export function promiseAllWithProgress<T>(
    promises: Promise<T>[], label: string): Promise<T[]> {
  if (promises.length === 0) {
    return Promise.all([]);
  }
  const progressBar = standardProgressBar(label, promises.length);
  const progressed: Promise<T>[] = [];
  for (const promise of promises) {
    let res: T;
    progressed.push(Promise.resolve(promise)
                        .then((resolution) => {
                          res = resolution;
                          return progressBar.tick();
                        })
                        .then(() => res));
  }
  return Promise.all(progressed);
}

/**
 * Factory function for Progress Bar instance establishing conventional label
 * and progress number format.
 */
export function standardProgressBar(label: string, total: number) {
  const pb = new ProgressBar(
      `${pad(label, progressMessageWidth, {strip: true})} [:bar] :percent`,
      {total, width: progressBarWidth});
  // force the progress bar to start at 0%
  pb.render();
  return pb;
}

export function progressMessage(msg: string): string {
  return pad(msg, progressMessageWidth, {strip: true});
}

/**
 * @returns a regular expression where all '*' characters in provided pattern
 * match any character but all other characters in pattern match only string
 * literals.
 */
export function wildcardRegExp(pattern: string): RegExp {
  return new RegExp(
      '^' + escapeStringRegexp(pattern).replace(/\\\*/g, '.*') + '$', 'i');
}
