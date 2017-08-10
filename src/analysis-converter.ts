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
import {Analysis, Document} from 'polymer-analyzer';

import {DocumentConverter} from './document-converter';
import {JsExport, JsModule} from './js-module';
import {convertHtmlDocumentUrl, getDocumentUrl} from './url-converter';


import jsc = require('jscodeshift');
import {ConverterMetadata} from './converter-metadata';

const _isInBowerRegex = /(\b|\/|\\)(bower_components)(\/|\\)/;
const _isInNpmRegex = /(\b|\/|\\)(node_modules)(\/|\\)/;
const isNotExternal = (d: Document) =>
    !_isInBowerRegex.test(d.url) && !_isInNpmRegex.test(d.url);

export interface BaseConverterOptions {
  /**
   * Namespace names used to detect exports. Namespaces declared in the
   * code with an @namespace declaration are automatically detected.
   */
  readonly namespaces?: Iterable<string>;

  /**
   * Files to exclude from conversion (ie lib/utils/boot.html). Imports
   * to these files are also excluded.
   */
  readonly excludes?: Iterable<string>;

  /**
   * Namespace references (ie, Polymer.DomModule) to "exclude"" be replacing
   * the entire reference with `undefined`.
   *
   * These references would normally be rewritten to module imports, but in some
   * cases they are accessed without importing. The presumption is that access
   * is guarded by a conditional and replcing with `undefined` will safely
   * fail the guard.
   */
  readonly referenceExcludes?: Iterable<string>;

  /**
   * For each namespace you can set a list of references (ie,
   * 'Polymer.telemetry.instanceCount') that need to be mutable and cannot be
   * exported as `const` variables. They will be exported as `let` variables
   * instead.
   */
  readonly mutableExports?:
      {readonly [namespaceName: string]: ReadonlyArray<string>};
}

export interface AnalysisConverterOptions extends BaseConverterOptions {
  readonly packageName: string;
  readonly packageType?: 'element'|'application';
  readonly mainFiles?: Iterable<string>;
}

/**
 * Converts an entire Analysis object.
 */
export class AnalysisConverter implements ConverterMetadata {
  private readonly _analysis: Analysis;
  readonly namespaces: ReadonlySet<string>;
  // These three properties are 'protected' in that they're accessable from
  // DocumentConverter.
  readonly packageName: string;
  readonly packageType: 'element'|'application';

  readonly excludes: ReadonlySet<string>;
  readonly includes: ReadonlySet<string>;
  readonly referenceExcludes: ReadonlySet<string>;
  readonly mutableExports?:
      {readonly [namespaceName: string]: ReadonlyArray<string>};

  readonly modules = new Map<string, JsModule>();
  readonly namespacedExports = new Map<string, JsExport>();

  readonly referenceRewrites: ReadonlyMap<string, estree.Node>;

  readonly dangerousReferences: ReadonlyMap<string, string>;

  constructor(analysis: Analysis, options: AnalysisConverterOptions) {
    this._analysis = analysis;
    const declaredNamespaces = [
      ...analysis.getFeatures(
          {kind: 'namespace', externalPackages: true, imported: true})
    ].map((n) => n.name);
    this.namespaces =
        new Set([...declaredNamespaces, ...(options.namespaces || [])]);

    const referenceRewrites = new Map<string, estree.Node>();
    const windowDotDocument = jsc.memberExpression(
        jsc.identifier('window'), jsc.identifier('document'));
    referenceRewrites.set(
        'document.currentScript.ownerDocument', windowDotDocument);
    this.referenceRewrites = referenceRewrites;

    const dangerousReferences = new Map<string, string>();
    dangerousReferences.set(
        'document.currentScript',
        `document.currentScript is always \`null\` in an ES6 module.`);
    this.dangerousReferences = dangerousReferences;

    this.packageName = options.packageName;
    this.packageType = options.packageType || 'element';
    this.excludes = new Set(options.excludes!);
    this.referenceExcludes = new Set(options.referenceExcludes!);
    this.mutableExports = options.mutableExports;
    const importedFiles = [...this._analysis.getFeatures(
                               {kind: 'import', externalPackages: false})]
                              .map((imp) => imp.url)
                              .filter(
                                  (url) =>
                                      !(url.startsWith('bower_components') ||
                                        url.startsWith('node_modules')));
    this.includes = new Set([...importedFiles, ...options.mainFiles || []]);
  }

  async convert(): Promise<Map<string, string>> {
    const htmlDocuments =
        [...this._analysis.getFeatures({kind: 'html-document'})]
            // Excludes
            .filter((d) => {
              return !this.excludes.has(d.url) && isNotExternal(d) && d.url;
            });

    const results = new Map<string, string>();

    for (const document of htmlDocuments) {
      try {
        let convertedModule;
        if (this.includes.has(document.url)) {
          convertedModule = this.convertDocument(document);
        } else {
          convertedModule = this.convertHtmlToHtml(document);
        }
        if (convertedModule) {
          results.set(convertedModule.url, convertedModule.source);
        }
      } catch (e) {
        console.error(`Error in ${document.url}`, e);
      }
    }

    return results;
  }

  /**
   * Converts a Polymer Analyzer HTML document to a JS module
   */
  convertDocument(document: Document): JsModule|undefined {
    const jsUrl = convertHtmlDocumentUrl(getDocumentUrl(document));
    if (!this.modules.has(jsUrl)) {
      this.handleNewJsModules(
          new DocumentConverter(
              this, document, this.packageName, this.packageType)
              .convertToJsModule());
    }
    return this.modules.get(jsUrl);
  }

  /**
   * Converts HTML Imports and inline scripts to module scripts as necessary.
   */
  convertHtmlToHtml(document: Document): JsModule|undefined {
    const htmlUrl = `./${document.url}`;
    if (!this.modules.has(htmlUrl)) {
      this.handleNewJsModules(
          new DocumentConverter(
              this, document, this.packageName, this.packageType)
              .convertAsToplevelHtmlDocument());
    }
    return this.modules.get(htmlUrl);
  }

  private handleNewJsModules(jsModules: Iterable<JsModule>): void {
    for (const jsModule of jsModules) {
      this.modules.set(jsModule.url, jsModule);
      for (const expr of jsModule.exportedNamespaceMembers) {
        this.namespacedExports.set(
            expr.oldNamespacedName,
            new JsExport(jsModule.url, expr.es6ExportName));
      }
    }
  }
}
