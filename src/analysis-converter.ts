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

import * as dom5 from 'dom5';
import {Expression} from 'estree';
import * as parse5 from 'parse5';
import {Analysis, Document} from 'polymer-analyzer';

import {DocumentConverter} from './document-converter';
import {htmlUrlToJs} from './url-converter';

const _isInTestRegex = /(\b|\/|\\)(test)(\/|\\)/;
const isNotTest = (d: Document) => !_isInTestRegex.test(d.url);

const _isInBowerRegex = /(\b|\/|\\)(bower_components)(\/|\\)/;
const _isInNpmRegex = /(\b|\/|\\)(node_modules)(\/|\\)/;
const isNotExternal = (d: Document) =>
    !_isInBowerRegex.test(d.url) && !_isInNpmRegex.test(d.url);

export interface JsExport {
  /**
   * URL of the JS module.
   */
  readonly url: string;

  /**
   * Exported name, ie Foo for `export Foo`;
   *
   * The name * represents the entire module, for when the key in the
   * namespacedExports Map represents a namespace object.
   */
  readonly name: string;
}

export interface JsModule {
  /**
   * Package-relative URL of the converted JS module.
   */
  readonly url: string;

  /**
   * Converted source of the JS module.
   */
  source: string;

  /**
   * Set of exported names.
   */
  readonly exports: Set<string>;

  /**
   * Map of module URL (ie, polymer-element.js) to imported references
   * (ie, Element). This map is used to rewrite import statements to
   * only include what's used in an importing module.
   */
  readonly importedReferences: Map<string, Set<string>>;
}

/**
 * A collection of converted JS modules and exported namespaced identifiers.
 */
export interface ModuleIndex {
  /**
   * Map of module URL to JsModule
   */
  readonly modules: Map<string, JsModule>;

  /**
   * Map of namespaced id (ie, Polymer.Element) to module URL
   * (ie, polymeer-element.js) + exported name (ie, Element).
   */
  readonly namespacedExports: Map<string, JsExport>;
}


export interface AnalysisConverterOptions {
  /**
   * Namespace names used to detect exports. Namespaces declared in the
   * code with an @namespace declaration are automatically detected.
   */
  readonly namespaces?: Iterable<string>;

  readonly mainFiles?: Iterable<string>;

  /**
   * Files to exclude from conversion (ie lib/utils/boot.html). Imports
   * to these files are also excluded.
   */
  readonly excludes?: string[];

  /**
   * Namespace references (ie, Polymer.DomModule) to "exclude"" be replacing
   * the entire reference with `undefined`.
   *
   * These references would normally be rewritten to module imports, but in some
   * cases they are accessed without importing. The presumption is that access
   * is guarded by a conditional and replcing with `undefined` will safely
   * fail the guard.
   */
  readonly referenceExcludes?: string[];

  /**
   * For each namespace you can set a list of references (ie,
   * 'Polymer.telemetry.instanceCount') that need to be mutable and cannot be
   * exported as `const` variables. They will be exported as `let` variables
   * instead.
   */
  readonly mutableExports?: {[namespaceName: string]: string[]};
}

/**
 * Converts an entire Analysis object.
 */
export class AnalysisConverter {
  private readonly _analysis: Analysis;
  readonly namespaces: ReadonlySet<string>;
  // These three properties are 'protected' in that they're accessable from
  // DocumentConverter.
  readonly _excludes: ReadonlySet<string>;
  readonly _includes: ReadonlySet<string>;
  readonly _referenceExcludes: ReadonlySet<string>;
  readonly _mutableExports?: {readonly [namespaceName: string]: string[]};

  readonly modules = new Map<string, JsModule>();
  readonly namespacedExports = new Map<string, JsExport>();

  constructor(analysis: Analysis, options: AnalysisConverterOptions = {}) {
    this._analysis = analysis;
    const declaredNamespaces = [
      ...analysis.getFeatures(
          {kind: 'namespace', externalPackages: true, imported: true})
    ].map((n) => n.name);
    this.namespaces =
        new Set([...declaredNamespaces, ...(options.namespaces || [])]);
    this._excludes = new Set(options.excludes);
    this._referenceExcludes = new Set(options.referenceExcludes);
    this._mutableExports = options.mutableExports;
    const importedFiles = [...this._analysis.getFeatures(
                               {kind: 'import', externalPackages: false})]
                              .map((imp) => imp.url)
                              .filter(
                                  (url) =>
                                      !(url.startsWith('bower_components') ||
                                        url.startsWith('node_modules')));
    this._includes = new Set([...importedFiles, ...options.mainFiles || []]);
  }

  async convert(): Promise<Map<string, string>> {
    const htmlDocuments =
        [...this._analysis.getFeatures({kind: 'html-document'})]
            // Excludes
            .filter((d) => {
              return !this._excludes.has(d.url) && isNotExternal(d) &&
                  isNotTest(d) && d.url;
            });
    const [toConvertToModules, toKeepAsHtml] =
        partition(htmlDocuments, (d) => this._includes.has(d.url));

    const results = new Map<string, string>();

    for (const document of toConvertToModules) {
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

    for (const document of toKeepAsHtml) {
      try {
        results.set('./' + document.url, this.convertJustHtmlImports(document));
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

  /**
   * Converts only the HTML Imports in a document to module script tags.
   */
  convertJustHtmlImports(document: Document): string {
    let source = document.parsedDocument.contents;
    const imports = [...document.getFeatures({kind: 'html-import'})];
    // Go bottom up, so our changes to the source don't clash
    imports.reverse();
    for (const imp of imports) {
      // Only replace imports that are actually in the document.
      if (!imp.sourceRange) {
        continue;
      }
      const scriptTag =
          parse5.treeAdapters.default.createElement('script', '', []);
      dom5.setAttribute(scriptTag, 'type', 'module');
      dom5.setAttribute(scriptTag, 'src', htmlUrlToJs(imp.url));
      const container = parse5.treeAdapters.default.createDocumentFragment();
      dom5.append(container, scriptTag);
      const replacementText = parse5.serialize(container);
      const [start, end] =
          document.parsedDocument.sourceRangeToOffsets(imp.sourceRange);
      source = source.slice(0, start) + replacementText + source.slice(end);
    }
    return source;
  }
}

/**
 * Returns an array of identifiers if an expression is a chain of property
 * access, as used in namespace-style exports.
 */
export function getMemberPath(expression: Expression): string[]|undefined {
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

function partition<V>(
    iter: Iterable<V>, predicate: (v: V) => boolean): [V[], V[]] {
  const yes = [];
  const no = [];
  for (const val of iter) {
    if (predicate(val)) {
      yes.push(val);
    } else {
      no.push(val);
    }
  }
  return [yes, no];
}
