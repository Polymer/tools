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

import * as estree from 'estree';
import {resolve as resolveUrl} from 'url';

import {Visitor} from '../javascript/estree-visitor';
import {JavaScriptDocument} from '../javascript/javascript-document';
import {JavaScriptScanner} from '../javascript/javascript-scanner';
import {ScannedImport} from '../model/model';

export class JavaScriptImportScanner implements JavaScriptScanner {
  async scan(
      document: JavaScriptDocument,
      visit: (visitor: Visitor) => Promise<void>): Promise<ScannedImport[]> {
    const imports: ScannedImport[] = [];

    await visit({
      enterImportDeclaration(node: estree.ImportDeclaration, _: estree.Node) {
        const source = node.source.value as string;
        if (!isPathImport(source)) {
          // TODO(justinfagnani): push a warning
          return;
        }
        const importUrl = resolveUrl(document.url, source);
        imports.push(new ScannedImport(
            'js-import',
            importUrl,
            document.sourceRangeForNode(node)!,
            document.sourceRangeForNode(node.source)!,
            node));
      }
    });
    return imports;
  }
}

function isPathImport(source: string): boolean {
  return /^(\/|\.\/|\.\.\/)/.test(source);
}
