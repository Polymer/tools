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

import {Analysis, Document} from 'polymer-analyzer';

import {ConversionSettings, createDefaultConversionSettings, PartialConversionSettings} from './conversion-settings';
import {DocumentConverter} from './document-converter';
import {ConversionResult, JsExport} from './js-module';
import {ConvertedDocumentFilePath, OriginalDocumentUrl} from './urls/types';
import {getDocumentUrl} from './urls/util';

// NOTE(fks) 11-06-2017: LEGACY!!!
// Left over from ConversionMetadata, when the settings were mixed in to the
// converter and its cache/results. Refactored out in the final PR, but left
// in for now to keep this PR manageable.
export interface ProjectConverterInterface {
  readonly namespacedExports: Map<string, JsExport>;
  readonly conversionResults: Map<OriginalDocumentUrl, ConversionResult>;
  convertDocument(document: Document, visited: Set<OriginalDocumentUrl>): void;
  shouldConvertDocument(document: Document): boolean;
}

export abstract class BaseConverter implements ProjectConverterInterface {
  protected readonly _analysis: Analysis;
  protected readonly settings: ConversionSettings;

  /**
   * A cache of all JS Exports by namespace, to map implicit HTML imports to
   * explicit named JS imports.
   */
  readonly namespacedExports = new Map<string, JsExport>();
  /**
   * A cache of all converted documents. Document conversions should be
   * idempotent, so conversion results can be safely cached.
   */
  readonly conversionResults = new Map<OriginalDocumentUrl, ConversionResult>();

  constructor(analysis: Analysis, options: PartialConversionSettings) {
    this._analysis = analysis;
    this.settings = createDefaultConversionSettings(analysis, options);
  }

  async convert(): Promise<Map<ConvertedDocumentFilePath, string|undefined>> {
    const htmlDocuments =
        [...this._analysis.getFeatures({kind: 'html-document'})]
            // Excludes
            .filter((d) => {
              return !this.settings.excludes.has(d.url) && d.url &&
                  this.filter(d);
            });

    const outputs = new Map<ConvertedDocumentFilePath, string|undefined>();

    for (const document of htmlDocuments) {
      try {
        this.settings.includes.has(document.url) ?
            this.convertDocument(document, new Set()) :
            this.convertHtmlToHtml(document, new Set());
      } catch (e) {
        console.error(`Error in ${document.url} -- `, e);
      }
    }

    for (const convertedModule of this.conversionResults.values()) {
      if (convertedModule.originalUrl.endsWith(
              'shadycss/entrypoints/apply-shim.js') ||
          convertedModule.originalUrl.endsWith(
              'shadycss/entrypoints/custom-style-interface.js')) {
        // These are already ES6, and messed with in url-converter.
        continue;
      }
      if (convertedModule.keepOriginal !== true) {
        outputs.set(
            convertedModule.originalUrl as string as ConvertedDocumentFilePath,
            undefined);
      }
      outputs.set(
          convertedModule.convertedFilePath, convertedModule.output.source);
    }

    return outputs;
  }

  /**
   * Check if a document is explicitly excluded or has already been converted
   * to decide if it should be converted or skipped.
   */
  shouldConvertDocument(document: Document): boolean {
    const documentUrl = getDocumentUrl(document);
    if (this.conversionResults.has(documentUrl)) {
      return false;
    }
    for (const exclude of this.settings.excludes) {
      if (documentUrl.endsWith(exclude)) {
        return false;
      }
    }
    return true;
  }

  /**
   * Converts a Polymer Analyzer HTML document to a JS module
   */
  convertDocument(document: Document, visited: Set<OriginalDocumentUrl>) {
    if (!this.shouldConvertDocument(document)) {
      return;
    }
    const newModule =
        this.getDocumentConverter(document, visited).convertToJsModule();
    this.handleNewJsModules(newModule);
  }

  /**
   * Converts HTML Imports and inline scripts to module scripts as necessary.
   */
  convertHtmlToHtml(document: Document, visited: Set<OriginalDocumentUrl>) {
    if (!this.shouldConvertDocument(document)) {
      return;
    }
    const newModule = this.getDocumentConverter(document, visited)
                          .convertAsToplevelHtmlDocument();
    this.handleNewJsModules(newModule);
  }

  private handleNewJsModules(newModule: ConversionResult): void {
    this.conversionResults.set(newModule.originalUrl, newModule);
    if (newModule.output.type === 'js-module') {
      for (const expr of newModule.output.exportedNamespaceMembers) {
        this.namespacedExports.set(
            expr.oldNamespacedName,
            new JsExport(newModule.convertedUrl, expr.es6ExportName));
      }
    }
  }

  protected filter(_document: Document) {
    return true;
  }

  protected abstract getDocumentConverter(
      document: Document, visited: Set<OriginalDocumentUrl>): DocumentConverter;
}
