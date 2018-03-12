/**
 * @license
 * Copyright (c) 2015 The Polymer Project Authors. All rights reserved.
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

import * as babel from 'babel-types';
import {dirname, relative} from 'path';
import {URL} from 'whatwg-url';

import {Document, FileRelativeUrl, Import, ResolvedUrl, ScannedImport, Severity, Warning} from '../model/model';

import {Visitor} from './estree-visitor';
import {JavaScriptDocument} from './javascript-document';
import {JavaScriptScanner} from './javascript-scanner';

import isWindows = require('is-windows');
import resolve = require('resolve');
import {SourceRange} from '../model/model';

const isPathSpecifier = (s: string) => /^\.{0,2}\//.test(s);

export interface JavaScriptImportScannerOptions {
  /**
   * Algorithm to use for resolving module specifiers in import
   * and export statements when converting them to URLs.
   * A value of 'node' uses Node.js resolution to find modules.
   *
   * If this argument is not given, module specifiers must be web-compatible
   * urls.
   */
  moduleResolution?: 'node';
}

export class ScannedJavascriptImport extends ScannedImport {
  readonly type!: 'js-import';

  // The original text of the specifier. Unlike `this.url`, this may not
  // be a URL, but may be a bare module specifier, like 'jquery'.
  readonly specifier: string;

  constructor(
      url: FileRelativeUrl|undefined, sourceRange: SourceRange|undefined,
      urlSourceRange: SourceRange|undefined,
      ast: babel.ImportDeclaration|babel.CallExpression|
      babel.ExportAllDeclaration|babel.ExportNamedDeclaration,
      lazy: boolean, originalSpecifier: string) {
    super('js-import', url, sourceRange, urlSourceRange, ast, lazy);
    this.specifier = originalSpecifier;
  }

  protected constructImport(
      resolvedUrl: ResolvedUrl, relativeUrl: FileRelativeUrl,
      importedDocument: Document, _containingDocument: Document) {
    return new JavascriptImport(
        resolvedUrl,
        relativeUrl,
        this.type,
        importedDocument,
        this.sourceRange,
        this.urlSourceRange,
        this.astNode,
        this.warnings,
        this.lazy,
        this.specifier);
  }
}

declare module '../model/queryable' {
  interface FeatureKindMap {
    'js-import': JavascriptImport;
  }
}
export class JavascriptImport extends Import {
  /**
   * The original text of the specifier. Unlike `this.url`, this may not
   * be a URL, but may be a bare module specifier, like 'jquery'.
   */
  readonly specifier: string;
  constructor(
      url: ResolvedUrl, originalUrl: FileRelativeUrl, type: string,
      document: Document, sourceRange: SourceRange|undefined,
      urlSourceRange: SourceRange|undefined,
      ast: babel.ImportDeclaration|babel.CallExpression|
      babel.ExportAllDeclaration|babel.ExportNamedDeclaration,
      warnings: Warning[], lazy: boolean, specifier: string) {
    super(
        url,
        originalUrl,
        type,
        document,
        sourceRange,
        urlSourceRange,
        ast,
        warnings,
        lazy);
    this.specifier = specifier;
  }
}

export class JavaScriptImportScanner implements JavaScriptScanner {
  moduleResolution?: 'node';
  constructor(options?: JavaScriptImportScannerOptions) {
    this.moduleResolution = options && options.moduleResolution;
  }

  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>) {
    const imports: ScannedJavascriptImport[] = [];
    const warnings: Warning[] = [];
    const scanner = this;

    await visit({
      enterCallExpression(node: babel.CallExpression, _: babel.Node) {
        // TODO(usergenic): There's no babel.Import type or babel.isImport()
        // function right now, we have to just check the type property
        // here until there is; please change to use babel.isImport(node.callee)
        // once it is a thing.
        if (node.callee.type as string !== 'Import') {
          return;
        }
        if (node.arguments.length !== 1) {
          warnings.push(new Warning({
            message: 'Malformed import',
            sourceRange: document.sourceRangeForNode(node)!,
            severity: Severity.WARNING,
            code: 'malformed-import',
            parsedDocument: document,
          }));
          return;
        }
        const arg = node.arguments[0];
        if (arg.type !== 'StringLiteral') {
          warnings.push(new Warning({
            message:
                'Cannot analyze dynamic imports with non-literal arguments',
            sourceRange: document.sourceRangeForNode(node)!,
            severity: Severity.WARNING,
            code: 'non-literal-import',
            parsedDocument: document,
          }));
          return;
        }
        const specifier = arg.value as string;
        imports.push(new ScannedJavascriptImport(
            scanner._resolveSpecifier(specifier, document, node, warnings),
            document.sourceRangeForNode(node)!,
            document.sourceRangeForNode(node.callee)!,
            node,
            true,
            specifier));
      },

      enterImportDeclaration(node: babel.ImportDeclaration, _: babel.Node) {
        const specifier = node.source.value;
        imports.push(new ScannedJavascriptImport(
            scanner._resolveSpecifier(specifier, document, node, warnings),
            document.sourceRangeForNode(node)!,
            document.sourceRangeForNode(node.source)!,
            node,
            false,
            specifier));
      },

      enterExportAllDeclaration(node, _parent) {
        const specifier = node.source.value;
        imports.push(new ScannedJavascriptImport(
            scanner._resolveSpecifier(specifier, document, node, warnings),
            document.sourceRangeForNode(node)!,
            document.sourceRangeForNode(node.source)!,
            node,
            false,
            specifier));
      },

      enterExportNamedDeclaration(node, _parent) {
        if (node.source == null) {
          return;
        }
        const specifier = node.source.value;
        imports.push(new ScannedJavascriptImport(
            scanner._resolveSpecifier(specifier, document, node, warnings),
            document.sourceRangeForNode(node)!,
            document.sourceRangeForNode(node.source)!,
            node,
            false,
            specifier));
      }

    });
    return {features: imports, warnings};
  }

  private _resolveSpecifier(
      specifier: string, document: JavaScriptDocument, node: babel.Node,
      warnings: Warning[]): FileRelativeUrl|undefined {
    if (isPathSpecifier(specifier)) {
      return specifier as FileRelativeUrl;
    }
    try {
      new URL(specifier);
      return specifier as FileRelativeUrl;
    } catch (e) {
      // not a parsable URL, try to resolve
    }
    if (this.moduleResolution !== 'node') {
      warnings.push(new Warning({
        message: 'Cannot resolve module specifier with no module resolution ' +
            'algorithm set',
        sourceRange: document.sourceRangeForNode(node)!,
        severity: Severity.WARNING,
        code: 'cant-resolve-module-specifier',
        parsedDocument: document,
      }));
      return undefined;
    }
    const documentURL = new URL(document.baseUrl);
    if (documentURL.protocol !== 'file:') {
      warnings.push(new Warning({
        message: 'Cannot resolve module specifier in non-local document',
        sourceRange: document.sourceRangeForNode(node)!,
        severity: Severity.WARNING,
        code: 'cant-resolve-module-specifier',
        parsedDocument: document,
      }));
      return undefined;
    }

    let documentPath = decodeURIComponent(documentURL.pathname);
    if (isWindows() && documentPath.startsWith('/')) {
      documentPath = documentPath.substring(1);
    }
    let resolvedSpecifier;
    try {
      resolvedSpecifier = resolve.sync(specifier, {basedir: documentPath});
    } catch (e) {
      warnings.push(new Warning({
        message: 'Cannot resolve module specifier',
        sourceRange: document.sourceRangeForNode(node)!,
        severity: Severity.WARNING,
        code: 'cant-resolve-module-specifier',
        parsedDocument: document,
      }));
      return undefined;
    }

    let relativeSpecifierUrl =
        relative(dirname(documentPath), resolvedSpecifier) as FileRelativeUrl;

    if (isWindows()) {
      // normalize path separators to URL format
      relativeSpecifierUrl =
          relativeSpecifierUrl.replace(/\\/g, '/') as FileRelativeUrl;
    }

    if (!isPathSpecifier(relativeSpecifierUrl)) {
      relativeSpecifierUrl = './' + relativeSpecifierUrl as FileRelativeUrl;
    }
    return relativeSpecifierUrl;
  }
}
