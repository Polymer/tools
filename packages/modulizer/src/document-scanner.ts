/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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

import {Document, Import, Severity, Warning} from 'polymer-analyzer';

import {DocumentProcessor} from './document-processor';
import {isImportWithDocument} from './import-with-document';
import {NamespaceMemberToExport} from './js-module';
import {rewriteNamespacesAsExports} from './passes/rewrite-namespace-exports';
import {ConvertedDocumentFilePath, ConvertedDocumentUrl, OriginalDocumentUrl} from './urls/types';
import {getHtmlDocumentConvertedFilePath} from './urls/util';

export type ScanResult =
    JsModuleScanResult|DeleteFileScanResult|HtmlDocumentScanResult;
/**
 * Contains information about how an existing file should be converted to a new
 * JS Module. Includes a mapping of its new exports.
 */
export interface JsModuleScanResult {
  type: 'js-module';
  originalUrl: OriginalDocumentUrl;
  convertedUrl: ConvertedDocumentUrl;
  convertedFilePath: ConvertedDocumentFilePath;
  exportMigrationRecords: NamespaceMemberToExport[];
}

/**
 * Contains information that an existing file should be deleted during
 * conversion.
 */
export interface DeleteFileScanResult {
  type: 'delete-file';
  originalUrl: OriginalDocumentUrl;
  convertedUrl: undefined;
  convertedFilePath: undefined;
}

/**
 * Contains information that an existing file should be converted as a top-level
 * HTML file (and not as a new JS module).
 */
export interface HtmlDocumentScanResult {
  type: 'html-document';
  originalUrl: OriginalDocumentUrl;
  convertedUrl: ConvertedDocumentUrl;
  convertedFilePath: ConvertedDocumentFilePath;
}


/**
 * Processes a document to determine a ScanResult for it.
 */
export class DocumentScanner extends DocumentProcessor {
  /**
   * Scan a document's new interface as a JS Module.
   */
  scanJsModule(): DeleteFileScanResult|JsModuleScanResult {
    if (this._isWrapperHTMLDocument) {
      return {
        type: 'delete-file',
        originalUrl: this.originalUrl,
        convertedUrl: undefined,
        convertedFilePath: undefined,
      };
    }

    const {exportMigrationRecords} = rewriteNamespacesAsExports(
        this.program, this.document, this.conversionSettings.namespaces);

    return {
      type: 'js-module',
      originalUrl: this.originalUrl,
      convertedUrl: this.convertedUrl,
      convertedFilePath: this.convertedFilePath,
      exportMigrationRecords,
    };
  }

  /**
   * Scan a document as a top-level HTML document. Top-level HTML documents
   * have no exports to scan, so this returns a simple object containing
   * relevant url mapping information.
   */
  scanTopLevelHtmlDocument(): HtmlDocumentScanResult {
    return {
      type: 'html-document',
      convertedUrl: this.convertedUrl,
      originalUrl: this.originalUrl,
      convertedFilePath:
          getHtmlDocumentConvertedFilePath(this.convertedFilePath),
    };
  }

  /**
   * Determines if a document is just a wrapper around a script tag pointing
   * to an external script of the same name as this file.
   */
  private get _isWrapperHTMLDocument() {
    const allFeatures = Array.from(this.document.getFeatures())
                            .filter(
                                (f) =>
                                    !(f.kinds.has('html-document') &&
                                      (f as Document).isInline === false));
    if (allFeatures.length === 1) {
      const f = allFeatures[0];
      if (f.kinds.has('html-script')) {
        const scriptImport = f as Import;
        if (!isImportWithDocument(scriptImport)) {
          console.warn(
              new Warning({
                code: 'import-ignored',
                message: `Import could not be loaded and will be ignored.`,
                parsedDocument: this.document.parsedDocument,
                severity: Severity.WARNING,
                sourceRange: scriptImport.sourceRange!,
              }).toString());
          return false;
        }
        const oldScriptUrl =
            this.urlHandler.getDocumentUrl(scriptImport.document);
        const newScriptUrl = this.convertScriptUrl(oldScriptUrl);
        return newScriptUrl === this.convertedUrl;
      }
    }
    return false;
  }
}
