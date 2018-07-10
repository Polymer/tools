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

import {OriginalDocumentUrl} from './urls/types';

export type NpmImportStyle = 'name'|'path';
export type PackageType = 'element'|'application';

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
   * A map from original package names to entrypoints to be used when converting
   * each listed package. Setting an entry in this map completely replaces the
   * default entrypoints for that package.
   */
  readonly packageEntrypoints: Map<string, OriginalDocumentUrl[]>;

  /**
   * Files to exclude from conversion (ie lib/utils/boot.html).
   */
  readonly excludes: Set<string>;

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

  /**
   * Whether to add the static importMeta static property (set to import.meta)
   * to elements.
   */
  readonly addImportMeta: boolean;
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

  readonly packageEntrypoints?: Map<string, OriginalDocumentUrl[]>;

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

  /**
   * Whether to add the static importMeta property (set to import.meta) to
   * elements.
   */
  readonly addImportMeta?: boolean;

  /**
   * After conversion, delete all files/directories that match any of these
   * glob patterns.
   */
  readonly deleteFiles?: Iterable<string>;

  /**
   * Whether to set flat:true in the newly generated package.json.,
   */
  readonly flat: boolean;

  /**
   * Whether to set private:true in the newly generated package.json.
   */
  readonly private: boolean;
}

/**
 * Get all namespace names for an analysis object.
 */
function getNamespaceNames(analysis: Analysis) {
  return IterableX
      .from(analysis.getFeatures(
          {kind: 'namespace', externalPackages: true, imported: true}))
      .map((n) => {
        const name = n.name;
        if (name.startsWith('window.')) {
          return name.slice('window.'.length);
        }
        return name;
      });
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
      new Set(getNamespaceNames(analysis).concat(options.namespaces || []));

  // Configure "packageEntrypoints":
  const packageEntrypoints = options.packageEntrypoints || new Map();

  // Configure "excludes":
  const excludes = new Set(
      [...(options.excludes || []), 'neon-animation/web-animations.html']);

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

  // Configure "npmImportStyle", defaults to false
  const addImportMeta = options.addImportMeta === true;

  // Return configured settings.
  return {
    namespaces,
    packageEntrypoints,
    excludes,
    referenceExcludes,
    referenceRewrites,
    npmImportStyle,
    addImportMeta,
  };
}
