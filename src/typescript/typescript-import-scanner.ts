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
import {resolve as resolveUrl} from 'url';

import {ScannedImport, SourceRange} from '../model/model';
import {Scanner} from '../scanning/scanner';

import {Node, ParsedTypeScriptDocument, Visitor} from './typescript-document';

export class TypeScriptImportScanner implements
    Scanner<ParsedTypeScriptDocument, Node, Visitor> {
  async scan(
      document: ParsedTypeScriptDocument,
      visit: (visitor: Visitor) => Promise<void>): Promise<ScannedImport[]> {
    const imports: ScannedImport[] = [];
    class ImportVisitor extends Visitor {
      visitImportDeclaration(node: ImportDeclaration):
          void {  // I can't figure out the proper way to get the text value
                  // here:
        const specifier = node.moduleSpecifier['text'];
        const importUrl = resolveUrl(document.url, specifier);
        imports.push(new ScannedImport(
            'js-import',
            importUrl,
            // TODO(justinfagnani): make SourceRanges work
            null as any as SourceRange,
            null as any as SourceRange,
            node));
      }
    }
    const visitor = new ImportVisitor();
    await visit(visitor);
    return imports;
  }
}
