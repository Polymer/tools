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

import {Document} from './document';
import {Feature} from './feature';
import {SourceRange} from './model';
import {Resolvable} from './resolvable';
import {FileRelativeUrl, ResolvedUrl} from './url';
import {Severity, Warning} from './warning';


/**
 * Represents an import, such as an HTML import, an external script or style
 * tag, or an JavaScript import.
 *
 * @template N The AST node type
 */
export class ScannedImport implements Resolvable {
  readonly type: 'html-import'|'html-script'|'html-style'|'js-import'|string;

  /**
   * URL of the import, relative to the base directory.
   */
  url: FileRelativeUrl|undefined;

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
      type: string, url: FileRelativeUrl|undefined,
      sourceRange: SourceRange|undefined, urlSourceRange: SourceRange|undefined,
      ast: any|null, lazy: boolean) {
    this.type = type;
    this.url = url;
    this.sourceRange = sourceRange;
    this.urlSourceRange = urlSourceRange;
    this.astNode = ast;
    this.lazy = lazy;
  }

  resolve(document: Document): Import|undefined {
    const resolvedUrl = this.getLoadableUrlOrWarn(document);
    if (this.url === undefined || resolvedUrl === undefined) {
      // Warning will already have been added to the document if necessary, so
      // we can just return here.
      return undefined;
    }

    const importedDocumentOrWarning =
        document._analysisContext.getDocument(resolvedUrl);
    let importedDocument: Document|undefined;
    if (!(importedDocumentOrWarning instanceof Document)) {
      this.addCouldNotLoadWarning(document, importedDocumentOrWarning);
      importedDocument = undefined;
    } else {
      importedDocument = importedDocumentOrWarning;
    }
    return this.constructImport(
        resolvedUrl, this.url, importedDocument, document);
  }

  protected constructImport(
      resolvedUrl: ResolvedUrl, relativeUrl: FileRelativeUrl,
      importedDocument: Document|undefined, _containingDocument: Document) {
    return new Import(
        resolvedUrl,
        relativeUrl,
        this.type,
        importedDocument,
        this.sourceRange,
        this.urlSourceRange,
        this.astNode,
        this.warnings,
        this.lazy);
  }

  protected addCouldNotLoadWarning(document: Document, warning?: Warning) {
    const error = this.error && this.error.message || this.error ||
        warning && warning.message || '';
    document.warnings.push(new Warning({
      code: 'could-not-load',
      message: `Unable to load import: ${error}`,
      sourceRange: (this.urlSourceRange || this.sourceRange)!,
      severity: Severity.ERROR,
      parsedDocument: document.parsedDocument,
    }));
  }

  /**
   * Resolve the URL for this import and return it if the analyzer
   */
  protected getLoadableUrlOrWarn(document: Document): ResolvedUrl|undefined {
    if (this.url === undefined) {
      return;
    }
    const resolvedUrl = document._analysisContext.resolver.resolve(
        document.parsedDocument.baseUrl, this.url, this);
    if (!resolvedUrl) {
      return;
    }
    if (!document._analysisContext.loader.canLoad(resolvedUrl)) {
      // We have no way to load this resolved URL, so we will warn.
      document.warnings.push(new Warning({
        code: 'not-loadable',
        message: `URL loader not configured to load '${resolvedUrl}'`,
        sourceRange: (this.urlSourceRange || this.sourceRange)!,
        severity: Severity.WARNING,
        parsedDocument: document.parsedDocument,
      }));
      return undefined;
    }
    return resolvedUrl;
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
    'css-import': Import;
  }
}

export class Import implements Feature {
  readonly type: 'html-import'|'html-script'|'html-style'|string;
  readonly url: ResolvedUrl;
  readonly originalUrl: FileRelativeUrl;
  readonly document: Document|undefined;
  readonly identifiers = new Set();
  readonly kinds = new Set(['import']);
  readonly sourceRange: SourceRange|undefined;
  readonly urlSourceRange: SourceRange|undefined;
  readonly astNode: any|null;
  readonly warnings: Warning[];
  readonly lazy: boolean;

  constructor(
      url: ResolvedUrl, originalUrl: FileRelativeUrl, type: string,
      document: Document|undefined, sourceRange: SourceRange|undefined,
      urlSourceRange: SourceRange|undefined, ast: any, warnings: Warning[],
      lazy: boolean) {
    this.url = url;
    this.originalUrl = originalUrl;
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
