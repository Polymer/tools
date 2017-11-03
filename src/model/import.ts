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

import {resolve as resolveUrl} from 'url';

import {Document} from './document';
import {Feature} from './feature';
import {SourceRange} from './model';
import {Resolvable} from './resolvable';
import {FileRelativeUrl, PackageRelativeUrl, ResolvedUrl} from './url';
import {Severity, Warning} from './warning';


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
  url: PackageRelativeUrl;

  sourceRange: SourceRange|undefined;

  error: {message?: string}|undefined;

  /**
   * The source range specifically for the URL or reference to the imported
   * resource.
   */
  urlSourceRange: SourceRange|undefined;

  astNode: any|null;

  warnings: Warning[] = [];

  /**
   * If true, the imported document may not be loaded until well after the
   * containing document has been evaluated, and indeed may never load.
   */
  lazy: boolean;

  constructor(
      type: string, url: PackageRelativeUrl, sourceRange: SourceRange|undefined,
      urlSourceRange: SourceRange|undefined, ast: any|null, lazy: boolean) {
    this.type = type;
    this.url = url;
    this.sourceRange = sourceRange;
    this.urlSourceRange = urlSourceRange;
    this.astNode = ast;
    this.lazy = lazy;
  }

  resolve(document: Document): Import|undefined {
    if (!document._analysisContext.canResolveUrl(this.url)) {
      return;
    }
    const importedDocumentOrWarning = document._analysisContext.getDocument(
        document._analysisContext.resolveUrl(this.url));
    if (!(importedDocumentOrWarning instanceof Document)) {
      const error = this.error ? (this.error.message || this.error) : '';
      document.warnings.push(new Warning({
        code: 'could-not-load',
        message: `Unable to load import: ${error}`,
        sourceRange: (this.urlSourceRange || this.sourceRange)!,
        severity: Severity.ERROR,
        parsedDocument: document.parsedDocument,
      }));
      return undefined;
    }
    return new Import(
        document._analysisContext.resolveUrl(this.url),
        this.type,
        importedDocumentOrWarning,
        this.sourceRange,
        this.urlSourceRange,
        this.astNode,
        this.warnings,
        this.lazy);
  }

  static resolveUrl(baseUrl: ResolvedUrl, localUrl: FileRelativeUrl):
      PackageRelativeUrl {
    return resolveUrl(baseUrl, localUrl) as PackageRelativeUrl;
  }
}

declare module './queryable' {
  interface FeatureKindMap {
    'import': Import;
    'lazy-import': Import;

    // Import specializations.
    'html-import': Import;
    'html-script': Import;
    'html-style': Import;
    'js-import': Import;
    'css-import': Import;
  }
}

export class Import implements Feature {
  readonly type: 'html-import'|'html-script'|'html-style'|string;
  readonly url: ResolvedUrl;
  readonly document: Document;
  readonly identifiers = new Set();
  readonly kinds = new Set(['import']);
  readonly sourceRange: SourceRange|undefined;
  readonly urlSourceRange: SourceRange|undefined;
  readonly astNode: any|null;
  readonly warnings: Warning[];
  readonly lazy: boolean;

  constructor(
      url: ResolvedUrl, type: string, document: Document,
      sourceRange: SourceRange|undefined, urlSourceRange: SourceRange|undefined,
      ast: any, warnings: Warning[], lazy: boolean) {
    this.url = url;
    this.type = type;
    this.document = document;
    this.kinds.add(this.type);
    this.sourceRange = sourceRange;
    this.urlSourceRange = urlSourceRange;
    this.astNode = ast;
    this.warnings = warnings;
    this.lazy = lazy;
    if (lazy) {
      this.kinds.add('lazy-import');
    }
  }

  toString() {
    return `<Import type="${this.type}" url="${this.url}">`;
  }
}
