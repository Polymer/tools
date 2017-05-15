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

import {Analyzer} from '../core/analyzer';
import {SourceRange, Warning} from '../model/model';
import {InMemoryOverlayUrlLoader} from '../url-loader/overlay-loader';
import {UrlLoader} from '../url-loader/url-loader';
import {WarningPrinter} from '../warning/warning-printer';


export class UnexpectedResolutionError extends Error {
  resolvedValue: any;
  constructor(message: string, resolvedValue: any) {
    super(message);
    this.resolvedValue = resolvedValue;
  }
}

export async function invertPromise(promise: Promise<any>): Promise<any> {
  let value: any;
  try {
    value = await promise;
  } catch (e) {
    return e;
  }
  throw new UnexpectedResolutionError('Inverted Promise resolved', value);
}

export type Reference = Warning | SourceRange | undefined;

/**
 * Used for asserting that warnings or source ranges correspond to the right
 * parts of the source code.
 *
 * Non-test code probably wants WarningPrinter instead.
 */
export class CodeUnderliner {
  warningPrinter: WarningPrinter;
  constructor(urlLoader: UrlLoader) {
    this.warningPrinter =
        new WarningPrinter(null as any, {analyzer: new Analyzer({urlLoader})});
  }

  static withMapping(url: string, contents: string) {
    const urlLoader = new InMemoryOverlayUrlLoader();
    urlLoader.urlContentsMap.set(url, contents);
    return new CodeUnderliner(urlLoader);
  }

  /**
   * Converts one or more warnings/source ranges into underlined text.
   *                                                  ~~~~~~~~~~ ~~~~
   *
   * This has a loose set of types that it will accept in order to make
   * writing tests simple and legible.
   */
  async underline(reference: Reference): Promise<string>;
  async underline(references: Reference[]): Promise<string[]>;
  async underline(references: Reference|Reference[]): Promise<string|string[]> {
    if (!Array.isArray(references)) {
      if (references === undefined) {
        return 'No source range given.';
      }
      const sourceRange =
          isWarning(references) ? references.sourceRange : references;
      return '\n' + await this.warningPrinter.getUnderlinedText(sourceRange);
    }
    return Promise.all(references.map((ref) => this.underline(ref)));
  }
}

function isWarning(wOrS: Warning|SourceRange): wOrS is Warning {
  return 'code' in wOrS;
}
