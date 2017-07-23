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

import * as estree from 'estree';

import {getImportAlias, getModuleId} from './util';

import jsc = require('jscodeshift');


export interface JsModule {
  /**
   * Package-relative URL of the converted JS module.
   */
  readonly url: string;

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
  readonly url: string;

  /**
   * Exported name, ie Foo for `export Foo`;
   *
   * The name * represents the entire module, for when the key in the
   * namespacedExports Map represents a namespace object.
   */
  readonly name: string;

  constructor(url: string, name: string) {
    this.url = url;
    this.name = name;
  }

  expressionToAccess(): estree.Expression {
    if (this.name === '*') {
      return jsc.identifier(getModuleId(this.url));
    } else {
      return jsc.identifier(getImportAlias(this.name));
    }
  }
}

export interface NamespaceMemberToExport {
  oldNamespacedName: string;
  es6ExportName: string;
}
