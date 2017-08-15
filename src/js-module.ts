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

import {ConvertedDocumentUrl} from './url-converter';

export type ConversionOutput = DeleteFile | HtmlFile | JsModule;

export interface DeleteFile {
  readonly type: 'delete-file';
  readonly url: ConvertedDocumentUrl;
}

export interface HtmlFile {
  readonly type: 'html-file';
  readonly url: ConvertedDocumentUrl;

  readonly source: string;
}

export interface JsModule {
  readonly type: 'js-module';
  /**
   * Package-relative URL of the converted JS module.
   */
  readonly url: ConvertedDocumentUrl;

  /**
   * Converted source of the JS module.
   */
  readonly source: string;

  /**
   * Set of exported names.
   */
  readonly es6Exports: ReadonlySet<string>;

  readonly exportedNamespaceMembers: ReadonlyArray<NamespaceMemberToExport>;
}

export class JsExport {
  /**
   * URL of the JS module.
   */
  readonly url: ConvertedDocumentUrl;

  /**
   * Exported name, ie Foo for `export Foo`;
   *
   * The name * represents the entire module, for when the key in the
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
