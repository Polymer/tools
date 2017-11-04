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

import {Document, Import, ScannedImport, Severity, Warning} from '../model/model';

/**
 * <script> tags are represented in two different ways: as inline documents,
 * or as imports, dependeng on whether the tag has a `src` attribute. This class
 * represents a script tag with a `src` attribute as an import, so that the
 * analyzer loads and parses the referenced document.
 */
export class ScriptTagImport extends Import { type: 'html-script'; }

/**
 * A synthetic import that provides the document containing the script tag to
 * the javascript document defined/referenced by the script tag.
 */
export class ScriptTagBackReferenceImport extends Import {
  type: 'html-script-back-reference';
}

export class ScannedScriptTagImport extends ScannedImport {
  resolve(document: Document): ScriptTagImport|undefined {
    if (!document._analysisContext.canResolveUrl(this.url)) {
      return;
    }

    // TODO(justinfagnani): warn if the same URL is loaded from more than one
    // non-module script tag

    // TODO(justinfagnani): Use the analyzer cache, since this is duplicating an
    // analysis of the external script, but the document the analyzer has
    // doesn't have its container as a feature.
    // A better design might be to have the import itself be in charge of
    // producing document objects. This will fit better with JS modules, where
    // the type attribute drives how the document is parsed.
    //
    // See https://github.com/Polymer/polymer-analyzer/issues/615

    const scannedDocument = document._analysisContext._getScannedDocument(
        document._analysisContext.resolveUrl(this.url));
    if (scannedDocument) {
      const importedDocument =
          new Document(scannedDocument, document._analysisContext);

      // Scripts regularly make use of global variables or functions (e.g.
      // `Polymer()`, `$('#some-id')`, etc) that are defined in libraries
      // which are loaded via prior script tags or HTML imports.  Since
      // JavaScript defined within `<script>` tags or loaded by a
      // `<script src=...>` share scope with other scripts previously
      // loaded by the page, this synthetic import is added to support
      // queries for features of the HTML document which should be "visible"
      // to the JavaScript document.
      const backReference = new ScriptTagBackReferenceImport(
          document.url,
          'html-script-back-reference',
          document,
          this.sourceRange,
          this.urlSourceRange,
          this.astNode,
          this.warnings,
          false);
      importedDocument._addFeature(backReference);
      importedDocument.resolve();

      return new ScriptTagImport(
          document._analysisContext.resolveUrl(this.url),
          this.type,
          importedDocument,
          this.sourceRange,
          this.urlSourceRange,
          this.astNode,
          this.warnings,
          false);
    } else {
      // not found or syntax error
      const error = (this.error ? (this.error.message || this.error) : '');
      document.warnings.push(new Warning({
        code: 'could-not-load',
        message: `Unable to load import: ${error}`,
        sourceRange: (this.urlSourceRange || this.sourceRange)!,
        severity: Severity.ERROR,
        parsedDocument: document.parsedDocument
      }));
      return undefined;
    }
  }
}
