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

import {Warning} from '../warning/warning';

import {Document} from './document';
import {Feature} from './feature';
import {SourceRange} from './model';
import {Resolvable} from './resolvable';


/**
 * Represents an import, such as an HTML import, an external script or style
 * tag, or an JavaScript import.
 *
 * @template N The AST node type
 */
export class ScannedImport implements Resolvable {
  type: 'html-import'|'html-script'|'html-style'|'js-import'|string;

  /**
   * URL of the import, relative to the base directory.
   */
  url: string;

  sourceRange: SourceRange|undefined;

  /**
   * The source range specifically for the URL or reference to the imported
   * resource.
   */
  urlSourceRange: SourceRange|undefined;

  astNode: any|null;

  warnings: Warning[] = [];

  constructor(
      type: string, url: string, sourceRange: SourceRange|undefined,
      urlSourceRange: SourceRange|undefined, ast: any|null) {
    this.type = type;
    this.url = url;
    this.sourceRange = sourceRange;
    this.urlSourceRange = urlSourceRange;
    this.astNode = ast;
  }

  resolve(document: Document): Import|undefined {
    const importedDocument =
        document.analyzer._getDocument(this.url, document.url);
    return importedDocument && new Import(
                                   this.url,
                                   this.type,
                                   importedDocument,
                                   this.sourceRange,
                                   this.urlSourceRange,
                                   this.astNode,
                                   this.warnings);
  }
}

export class Import implements Feature {
  type: 'html-import'|'html-script'|'html-style'|string;
  url: string;
  document: Document;
  identifiers = new Set();
  kinds = new Set(['import']);
  sourceRange: SourceRange|undefined;
  urlSourceRange: SourceRange|undefined;
  astNode: any|null;
  warnings: Warning[];

  constructor(
      url: string, type: string, document: Document,
      sourceRange: SourceRange|undefined, urlSourceRange: SourceRange|undefined,
      ast: any, warnings: Warning[]) {
    this.url = url;
    this.type = type;
    this.document = document;
    this.kinds.add(this.type);
    this.sourceRange = sourceRange;
    this.urlSourceRange = urlSourceRange;
    this.astNode = ast;
    this.warnings = warnings;
  }

  toString() {
    return `<Import type="${this.type}" url="${this.url}">`;
  }
}
