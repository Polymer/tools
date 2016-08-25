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

import {SourceRange} from './ast';
import {ScannedFeature} from './descriptor';
import {Document, Feature, Resolvable, ScannedDocument} from './document-descriptor';



/**
 * Represents an import, such as an HTML import, an external script or style
 * tag, or an JavaScript import.
 *
 * @template N The AST node type
 */
export class ScannedImport implements ScannedFeature, Resolvable {
  type: 'html-import'|'html-script'|'html-style'|string;

  /**
   * URL of the import, relative to the document containing the import.
   */
  url: string;

  scannedDocument: ScannedDocument;

  sourceRange: SourceRange;

  constructor(type: string, url: string, sourceRange: SourceRange) {
    this.type = type;
    this.url = url;
    this.sourceRange = sourceRange;
  }

  resolve(_contextDocument: Document): Import {
    // The caller will set import.document;
    return new Import(this.url, this.type, this.sourceRange);
  }
}

export class Import implements Feature {
  type: 'html-import'|'html-script'|'html-style'|string;
  url: string;
  document: Document;
  identifiers = new Set();
  kinds: Set<string>;
  sourceRange: SourceRange;

  constructor(url: string, type: string, sourceRange: SourceRange) {
    this.url = url;
    this.type = type;
    this.kinds = new Set(['import', this.type]);
    this.sourceRange = sourceRange;
  }

  toString() {
    return `<Import type="${this.type}" url="${this.url}">`;
  }
}
