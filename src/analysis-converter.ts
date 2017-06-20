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

import * as path from 'path';

import {Document, Analysis} from 'polymer-analyzer';
import {Expression} from 'estree';

import { DocumentConverter } from "./document-converter";

const _isInTestRegex = /(\b|\/|\\)(test)(\/|\\)/;
const isNotTest = (d: Document) => !_isInTestRegex.test(d.url);

const _isInBowerRegex = /(\b|\/|\\)(bower_components)(\/|\\)/;
const _isInNpmRegex = /(\b|\/|\\)(node_modules)(\/|\\)/;
const isNotExternal = (d: Document) => !_isInBowerRegex.test(d.url) && !_isInNpmRegex.test(d.url);

export interface JsExport {
  /**
   * URL of the JS module.
   */
  url: string;

  /**
   * Exported name, ie Foo for `export Foo`;
   *
   * The name * represents the entire module, for when the key in the
   * namespacedExports Map represents a namespace object.
   */
  name: string;
}

export interface JsModule {
  /**
   * Package-relative URL of the converted JS module.
   */
  url: string;

  /**
   * Converted source of the JS module.
   */
  source: string;

  /**
   * Set of exported names.
   */
  exports: Set<string>;

  /**
   * Map of module URL (ie, polymer-element.js) to imported references
   * (ie, Element). This map is used to rewrite import statements to
   * only include what's used in an importing module.
   */
  importedReferences: Map<string, Set<string>>;
}

/**
 * A collection of converted JS modules and exported namespaced identifiers.
 */
export interface ModuleIndex {
  /**
   * Map of module URL to JsModule
   */
  modules: Map<string, JsModule>;

  /**
   * Map of namespaced id (ie, Polymer.Element) to module URL
   * (ie, polymeer-element.js) + exported name (ie, Element).
   */
  namespacedExports: Map<string, JsExport>;
}


export interface AnalysisConverterOptions {

  /**
   * The root namespace name that is used to detect exports.
   */
  rootModuleName?: string;

  /**
   * Files to exclude from conversion (ie lib/utils/boot.html). Imports
   * to these files are also excluded.
   */
  excludes?: string[];

  /**
   * Namespace references (ie, Polymer.DomModule) to "exclude"" be replacing
   * the entire reference with `undefined`.
   *
   * These references would normally be rewritten to module imports, but in some
   * cases they are accessed without importing. The presumption is that access
   * is guarded by a conditional and replcing with `undefined` will safely
   * fail the guard.
   */
  referenceExcludes?: string[];

  /**
   * For each namespace you can set a list of references (ie,
   * 'Polymer.telemetry.instanceCount') that need to be mutable and cannot be
   * exported as `const` variables. They will be exported as `let` variables
   * instead.
   */
  mutableExports?: {[namespaceName: string]: string[]};
}

/**
 * Converts an entire Analysis object.
 */
export class AnalysisConverter {

  analysis: Analysis;
  rootModuleName: string|undefined;
  _excludes: Set<string>;
  _referenceExcludes: Set<string>;
  _mutableExports?: {[namespaceName: string]: string[]};

  modules = new Map<string, JsModule>();
  namespacedExports = new Map<string, JsExport>();

  constructor(analysis: Analysis, options: AnalysisConverterOptions = {}) {
    this.analysis = analysis;
    this.rootModuleName = options.rootModuleName;
    this._excludes = new Set(options.excludes);
    this._referenceExcludes = new Set(options.referenceExcludes);
    this._mutableExports = options.mutableExports;
  }

  async convert(): Promise<Map<string, string>> {

    const htmlDocuments = Array.from(this.analysis.getFeatures({kind: 'html-document'}))
      .filter((d) => {
        return !this._excludes.has(d.url) && isNotExternal(d) && isNotTest(d) && d.url;
      });

    const results = new Map<string, string>()

    for (const document of htmlDocuments) {
      try {
        this.convertDocument(document);
        const jsUrl = htmlUrlToJs(document.url);
        const module = this.modules.get(jsUrl);
        const newSource = module && module.source;
        if (newSource) {
          results.set(jsUrl, newSource);
        }
      } catch (e) {
        console.error(`Error in ${document.url}`, e);
      }
    }
    return results;
  }

  /**
   * Converts a Polymer Analyzer HTML document to a JS module
   */
  convertDocument(document: Document): void {
    const jsUrl = htmlUrlToJs(document.url);
    if (this.modules.has(jsUrl)) {
      return;
    }
    new DocumentConverter(this, document).convert();
  }
}

/**
 * Returns an array of identifiers if an expression is a chain of property
 * access, as used in namespace-style exports.
 */
export function getMemberPath(expression: Expression): string[] | undefined {
  if (expression.type !== 'MemberExpression' ||
      expression.property.type !== 'Identifier') {
    return;
  }
  const property = expression.property.name;

  if (expression.object.type === 'ThisExpression') {
    return ['this', property];
  } else if (expression.object.type === 'Identifier') {
    if (expression.object.name === 'window') {
      return [property];
    } else {
      return [expression.object.name, property];
    }
  } else if (expression.object.type === 'MemberExpression') {
    const prefixPath = getMemberPath(expression.object);
    if (prefixPath !== undefined) {
      return [...prefixPath, property];
    }
  }
  return undefined;
}

/**
 * Converts an HTML Import path to a JS module path.
 */
function htmlUrlToJs(url: string, from?: string): string {
  const htmlExtension = '.html';
  let jsUrl = url;
  if (url.endsWith(htmlExtension)) {
    jsUrl = url.substring(0, url.length - htmlExtension.length) + '.js';
  }

  // We've lost the actual URL string and thus the leading ./
  // This should be fixed in the Analyzer, and this hack isn't even right
  if (from !== undefined) {
    jsUrl = path.posix.relative(path.posix.dirname(from), jsUrl);
  }
  if (!jsUrl.startsWith('.') && !jsUrl.startsWith('/')) {
    jsUrl = './' + jsUrl;
  }
  // Fix any references to ./bower_components/* to point to siblings instead
  if (jsUrl.startsWith('./bower_components/')) {
    jsUrl = '../' + jsUrl.slice('./bower_components/'.length);
  }
  return jsUrl;
}
