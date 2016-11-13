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

import {Document, Import, ScannedImport} from '../model/model';

/**
 * <script> tags are represented in two different ways: as inline documents,
 * or as imports, dependeng on whether the tag has a `src` attribute. This class
 * represents a script tag with a `src` attribute as an import, so that the
 * analyzer loads and parses the referenced document.
 */
export class ScriptTagImport extends Import { type: 'html-script'; }

export class ScannedScriptTagImport extends ScannedImport {
  resolve(document: Document): ScriptTagImport|undefined {
    // TODO(justinfagnani): warn if the same URL is loaded from more than one
    // non-module script tag

    // TODO(justinfagnani): Use the analyzer cache, since this is duplicating an
    // analysis of the external script, but the document the analyzer has
    // doesn't have its container as a feature.
    // A better design might be to have the import itself be in charge of
    // producing document objects. This will fit better with JS modules, where
    // the type attribute drives how the document is parsed.

    if (this.scannedDocument) {
      const importedDocument =
          new Document(this.scannedDocument, document.analyzer);
      importedDocument._addFeature(document);
      importedDocument.resolve();
      return new ScriptTagImport(
          this.url,
          this.type,
          importedDocument,
          this.sourceRange,
          this.urlSourceRange,
          this.astNode,
          this.warnings);
    } else {
      // not found or syntax error
      return undefined;
    }
  }
}
