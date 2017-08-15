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
import * as jsc from 'jscodeshift';
import {Analysis, Document} from 'polymer-analyzer';

import {BaseConverter} from './base-converter';
import {ConverterMetadata} from './converter-metadata';
import {DocumentConverter} from './document-converter';
import {ConversionOutput, JsExport} from './js-module';
import {ConvertedDocumentUrl, OriginalDocumentUrl} from './url-converter';
import {getNamespaces} from './util';

export interface WorkspaceConverterOptions {
  /**
   * Namespace names used to detect exports. Namespaces declared in the
   * code with an @namespace declaration are automatically detected.
   */
  readonly namespaces?: Iterable<string>;

  /**
   * Files to exclude from conversion (ie polymer/lib/utils/boot.html). Imports
   * to these files are also excluded.
   */
  readonly excludes?: Iterable<string>;

  /**
   * Namespace references (ie, Polymer.DomModule) to "exclude"" be replacing
   * the entire reference with `undefined`.
   *
   * These references would normally be rewritten to module imports, but in some
   * cases they are accessed without importing. The presumption is that access
   * is guarded by a conditional and replcing with `undefined` will safely
   * fail the guard.
   */
  readonly referenceExcludes?: Iterable<string>;

  /**
   * For each namespace you can set a list of references (ie,
   * 'Polymer.telemetry.instanceCount') that need to be mutable and cannot be
   * exported as `const` variables. They will be exported as `let` variables
   * instead.
   */
  readonly mutableExports?:
      {readonly [namespaceName: string]: ReadonlyArray<string>};
}

/**
 * Converts an entire Analysis object.
 */
export class WorkspaceConverter extends BaseConverter implements
    ConverterMetadata {
  protected readonly _analysis: Analysis;
  readonly namespaces: ReadonlySet<string>;

  readonly excludes: ReadonlySet<string>;
  readonly includes: ReadonlySet<string>;
  readonly referenceExcludes: ReadonlySet<string>;
  readonly mutableExports?:
      {readonly [namespaceName: string]: ReadonlyArray<string>};

  readonly outputs = new Map<ConvertedDocumentUrl, ConversionOutput>();
  readonly namespacedExports = new Map<string, JsExport>();

  readonly referenceRewrites: ReadonlyMap<string, estree.Node>;

  readonly dangerousReferences: ReadonlyMap<string, string>;

  constructor(analysis: Analysis, options: WorkspaceConverterOptions) {
    super();
    this._analysis = analysis;
    this.namespaces =
        new Set([...getNamespaces(analysis), ...(options.namespaces || [])]);

    const referenceRewrites = new Map<string, estree.Node>();
    const windowDotDocument = jsc.memberExpression(
        jsc.identifier('window'), jsc.identifier('document'));
    referenceRewrites.set(
        'document.currentScript.ownerDocument', windowDotDocument);
    this.referenceRewrites = referenceRewrites;

    const dangerousReferences = new Map<string, string>();
    dangerousReferences.set(
        'document.currentScript',
        `document.currentScript is always \`null\` in an ES6 module.`);
    this.dangerousReferences = dangerousReferences;

    this.excludes = new Set(options.excludes!);
    this.referenceExcludes = new Set(options.referenceExcludes!);
    this.mutableExports = options.mutableExports;
    const importedFiles = [...this._analysis.getFeatures(
                               {kind: 'import', externalPackages: false})]
                              .map((imp) => imp.url)
                              .filter(
                                  (url) =>
                                      !(url.startsWith('bower_components') ||
                                        url.startsWith('node_modules')));
    this.includes = new Set(importedFiles);
  }

  protected getDocumentConverter(
      document: Document,
      visited: Set<OriginalDocumentUrl>): DocumentConverter {
    const basePackageName = document.url.split('/')[0];
    const packageName = `@polymer/${basePackageName}`;
    return new DocumentConverter(
        this, document, packageName, 'element', visited);
  }
}
