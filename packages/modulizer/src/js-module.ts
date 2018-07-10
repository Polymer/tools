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

import {ConvertedDocumentFilePath, ConvertedDocumentUrl, OriginalDocumentUrl} from './urls/types';

export interface ConversionResult {
  readonly originalUrl: OriginalDocumentUrl;
  readonly convertedUrl: ConvertedDocumentUrl;
  readonly convertedFilePath: ConvertedDocumentFilePath;

  /**
   * Explicitly keep or remove the original file from disk. By default, the
   * original file will be destroyed. If the convertedFilePath matches
   * originalUrl, the original file will always be overwritten with the
   * converted output.
   */
  readonly deleteOriginal?: boolean;

  /**
   * An object describing the converted output of this module, or `undefined`.
   *
   * If `undefined`, no new file is created and the original file is deleted
   * regardless of the value of `deleteOriginal`. This is useful in cases where
   * there original is an HTML file that only loads an external script.
   */
  readonly output: string|undefined;
}

export class JsExport {
  /**
   * URL of the JS module.
   */
  readonly url: ConvertedDocumentUrl;

  /**
   * Exported name, ie Foo for `export Foo`;
   *
   * The name represents the entire module, for when the key in the
   * namespacedExports Map represents a namespace object.
   */
  readonly name: string;

  constructor(url: ConvertedDocumentUrl, name: string) {
    this.url = url;
    this.name = name;
  }
}

export interface NamespaceMemberToExport {
  oldNamespacedName: string;
  es6ExportName: string;
}
