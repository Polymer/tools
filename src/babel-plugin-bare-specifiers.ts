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

import {NodePath} from 'babel-traverse';
import {ExportAllDeclaration, ExportNamedDeclaration, ImportDeclaration} from 'babel-types';
import {resolve} from 'polymer-analyzer/lib/javascript/resolve-specifier-node';

const exportExtensions = require('babel-plugin-syntax-export-extensions');

const isPathSpecifier = (s: string) => /^\.{0,2}\//.test(s);

type HasSpecifier =
    ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration;

/**
 * Rewrites so-called "bare module specifiers" to be web-compatible paths.
 */
export const resolveBareSpecifiers = (
    filePath: string,
    isComponentRequest: boolean,
    packageName?: string,
    componentDir?: string,
    rootDir?: string,
    ) => ({
  inherits: exportExtensions,
  visitor: {
    'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(
        path: NodePath<HasSpecifier>) {
      const node = path.node;

      // An export without a 'from' clause
      if (node.source == null) {
        return;
      }

      const specifier = node.source.value;

      try {
        let componentInfo;
        if (isComponentRequest) {
          componentInfo = {
            packageName: packageName!,
            componentDir: componentDir!,
            rootDir: rootDir!,
          };
        }
        node.source.value = resolve(specifier, filePath, componentInfo);
      } catch (e) {
        if (!isPathSpecifier(specifier)) {
          // Don't warn if the specifier was already a path, even though we do
          // resolve paths, because maybe the user is serving it some other way.
          console.warn(`Could not resolve module specifier "${specifier}"`);
        }
        return;
      }

    }
  }
});
