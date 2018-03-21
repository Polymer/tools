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

import {dirname, join, relative} from 'path';

import resolve = require('resolve');
import {NodePath} from 'babel-traverse';
import * as isWindows from 'is-windows';
import * as whatwgUrl from 'whatwg-url';
import {ImportDeclaration, ExportNamedDeclaration, ExportAllDeclaration} from 'babel-types';

const pathIsInside = require('path-is-inside');

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

      if (whatwgUrl.parseURL(specifier) !== null) {
        return;
      }

      if (isPathSpecifier(specifier)) {
        return;
      }

      const resolvedSpecifier = resolve.sync(specifier, {
        basedir: filePath,
        // Some packages use a non-standard alternative to the "main" field
        // in their package.json to differentiate their ES module version.
        packageFilter:
            (packageJson:
                 {main?: string, module?: string, 'jsnext:main'?: string}) => {
              packageJson.main = packageJson.module ||
                  packageJson['jsnext:main'] || packageJson.main;
              return packageJson;
            },
      });

      let relativeSpecifierUrl: string;
      // If we have an import that crosses the top-level / componentDir
      // boundary, fix up the path to generate polyserve-style ../ cross-package
      // imports.
      if (isComponentRequest === true &&
          componentDir !== undefined && rootDir !== undefined &&
          pathIsInside(resolvedSpecifier, componentDir) &&
          !pathIsInside(filePath, componentDir)) {
        if (packageName === undefined) {
          throw new Error(
              'resolveBareSpecifiers(): packageName must be set when isComponentRequest === true');
        }
        const relativePathFromComponentDir =
            relative(componentDir, resolvedSpecifier);
        // Important: Create a URL pointing up from the root dir
        const relativeDistance =
            packageName!.startsWith('@') ? '../../' : '../';
        relativeSpecifierUrl = relative(
            dirname(filePath),
            join(rootDir, relativeDistance, relativePathFromComponentDir));
      } else {
        relativeSpecifierUrl = relative(dirname(filePath), resolvedSpecifier);
      }

      if (isWindows()) {
        relativeSpecifierUrl = relativeSpecifierUrl.replace(/\\/g, '/');
      }

      if (!isPathSpecifier(relativeSpecifierUrl)) {
        relativeSpecifierUrl = './' + relativeSpecifierUrl;
      }
      node.source.value = relativeSpecifierUrl;
    }
  }
});
