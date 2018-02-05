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

import {dirname, relative} from 'path';
import resolve = require('resolve');
import {NodePath} from 'babel-traverse';
import {ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration} from 'babel-types';

const exportExtensions = require('babel-plugin-syntax-export-extensions');

const isPathSpecifier = (s: string) => /^\.{0,2}\//.test(s);

type HasSpecifier =
    ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration;

/**
 * Rewrites so-called "bare module specifiers" to be web-compatible paths.
 */
export const resolveBareSpecifiers =
    (filePath: string, isComponentRequest: boolean) => ({
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

          if (isPathSpecifier(specifier)) {
            return;
          }

          const resolvedSpecifier =
              resolve.sync(specifier, {basedir: filePath});

          let relativeSpecifierUrl =
              relative(dirname(filePath), resolvedSpecifier);

          if (!isPathSpecifier(relativeSpecifierUrl)) {
            relativeSpecifierUrl = './' + relativeSpecifierUrl;
          }
          if (isComponentRequest &&
              relativeSpecifierUrl.startsWith('../node_modules/')) {
            // Remove ../node_modules for component serving
            relativeSpecifierUrl = '../' +
                relativeSpecifierUrl.substring('../node_modules/'.length);
          }
          node.source.value = relativeSpecifierUrl;
        }
      }
    });
