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

import {ImportDeclaration} from 'typescript';

import {ScannedImport, SourceRange} from '../model/model';
import {FileRelativeUrl} from '../model/url';
import {Scanner} from '../scanning/scanner';

import {Node, ParsedTypeScriptDocument, Visitor} from './typescript-document';

export class TypeScriptImportScanner implements
    Scanner<ParsedTypeScriptDocument, Node, Visitor> {
  async scan(
      document: ParsedTypeScriptDocument,
      visit: (visitor: Visitor) => Promise<void>) {
    const imports: ScannedImport[] = [];
    class ImportVisitor extends Visitor {
      visitImportDeclaration(node: ImportDeclaration): void { /* */
        // If getText() throws it's because it requires parent references
        const moduleSpecifier = node.moduleSpecifier.getText();
        // The specifier includes the quote characters, remove them
        const specifierUrl =
            moduleSpecifier.substring(1, moduleSpecifier.length - 1) as
            FileRelativeUrl;
        imports.push(new ScannedImport(
            'js-import',
            ScannedImport.resolveUrl(document.baseUrl, specifierUrl),
            // TODO(justinfagnani): make SourceRanges work
            null as any as SourceRange,
            null as any as SourceRange,
            node,
            false));
      }
    }
    const visitor = new ImportVisitor();
    await visit(visitor);
    return {features: imports};
  }
}
