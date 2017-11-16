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

import * as estree from 'estree';
import {Iterable as IterableX} from 'ix';
import * as jsc from 'jscodeshift';
import {Analysis} from 'polymer-analyzer';

import {getNamespaces} from './util';

export type NpmImportStyle = 'name'|'path';

/**
 * These are the settings used to configure the conversion. It contains
 * important information about what should be analyzed, what should be ignored,
 * and how each file should be formatted for conversion.
 */
export interface ConversionSettings {

  /**
   * Namespace names used to detect exports.
   */
  readonly namespaces: Set<string>;

  /**
   * Files to exclude from conversion (ie lib/utils/boot.html).
   */
  readonly excludes: Set<string>;

  /**
   * Files to include in JS conversion. By default this is all local files that
   * are imported anywhere inside the package. It is up to the conversion setup
   * to make sure this includes any entrypoints into the package (that would
   * never be imported themselves).
   *
   * Any files marked for conversion but not included in this set will be
   * converted in-place, remaining HTML. This is preferable for HTML entrypoints
   * like tests, demos, etc.
   *
   * Example: In "paper-input", `includes` by default will include all local
   * HTML files imported within the package (paper-input-behavior.html,
   * paper-input-error.html, etc). The package conversion setup is responsible
   * for adding the main package entrypoint (paper-input.html) as well. Other
   * entrypoints (test/index.html, demo/index.html, etc) that are not a part of
   * the module code should not be included in `includes` so that they remain
   * HTML files after conversion is complete.
   *
   * TODO(fks) 11-13-2017: Simplify this relationship and what it means to be
   * "marked for JS conversion" vs. "marked for HTML in-place conversion".
   */
  readonly includes: Set<string>;

  /**
   * Namespace references (ie, Polymer.DomModule) to "exclude" in the conversion
   * by replacing the entire reference with `undefined`. This assumes that those
   * references were conditionally checked for before accessing, or used in some
   * other way that this simple transformation is okay.
   *
   * ex: `if(Polymer.DomModule) {...` -> `if (undefined) {...`
   */
  readonly referenceExcludes: Set<string>;

  /**
   * Namespace references (ie, document.currentScript.ownerDocument) to
   * "rewrite" be replacing the entire reference with the given Node.
   *
   * ex: `document.currentScript.ownerDocument` -> `window.document`
   */
  readonly referenceRewrites: Map<string, estree.Node>;

  /**
   * The style of imports to use in conversion:
   *
   * - "name": import by npm package name
   *   (example) '@polymer/polymer/polymer-element.js'
   * - "path": import by relative path
   *   (example) '../../../@polymer/polymer/polymer-element.js'
   */
  readonly npmImportStyle: NpmImportStyle;
}

/**
 * This is the partial, user-provided configuration that a `ConversionSettings`
 * object is generated from. User values are processed and expected defaults are
 * added.
 */
export interface PartialConversionSettings {

  /**
   * Namespace names used to detect exports. Namespaces declared in the
   * code with an `@namespace` declaration are automatically detected.
   */
  readonly namespaces?: Iterable<string>;

  /**
   * Files to exclude from conversion (ie `lib/utils/boot.html`). Imports
   * to these files are also excluded.
   */
  readonly excludes?: Iterable<string>;

  /**
   * Namespace references (ie, `Polymer.DomModule`) to exclude be replacing
   * the entire reference with `undefined`.
   *
   * These references would normally be rewritten to module imports, but in some
   * cases they are accessed without importing. The presumption is that access
   * is guarded by a conditional and replcing with `undefined` will safely
   * fail the guard.
   */
  readonly referenceExcludes?: Iterable<string>;

  /**
   * The style of imports to use in conversion:
   *
   * - "name": import by npm package name
   *   (example) '@polymer/polymer/polymer-element.js'
   * - "path": import by relative path
   *   (example) '../../../@polymer/polymer/polymer-element.js'
   */
  readonly npmImportStyle?: NpmImportStyle;
}

/**
 * Setup the default conversion settings based on the project analysis and the
 * incomplete user-provided options.
 */
export function createDefaultConversionSettings(
    analysis: Analysis,
    options: PartialConversionSettings): ConversionSettings {
  // Configure "namespaces":
  const namespaces =
      new Set(getNamespaces(analysis).concat(options.namespaces || []));

  // Configure "excludes":
  const excludes = new Set(
      [...(options.excludes || []), 'neon-animation/web-animations.html']);

  // Configure "includes":
  const importedFiles =
      IterableX
          .from(analysis.getFeatures({kind: 'import', externalPackages: false}))
          .map((imp) => imp.url)
          .filter(
              (url) =>
                  !(url.startsWith('bower_components') ||
                    url.startsWith('node_modules')));
  const includes = new Set(importedFiles);

  // Configure "referenceExcludes":
  const referenceExcludes = new Set(options.referenceExcludes || [
    'Polymer.DomModule',
    'Polymer.Settings',
    'Polymer.log',
    'Polymer.rootPath',
    'Polymer.sanitizeDOMValue',
    'Polymer.Collection',
  ]);

  // Configure "referenceRewrites":
  const referenceRewrites = new Map<string, estree.Node>([
    [
      'document.currentScript.ownerDocument',
      jsc.memberExpression(jsc.identifier('window'), jsc.identifier('document'))
    ],
  ]);

  // Configure "npmImportStyle":
  const npmImportStyle = options.npmImportStyle || 'path';

  // Return configured settings.
  return {
    namespaces,
    excludes,
    includes,
    referenceExcludes,
    referenceRewrites,
    npmImportStyle,
  };
}
