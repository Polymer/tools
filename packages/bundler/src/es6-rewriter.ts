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
import traverse, {NodePath} from 'babel-traverse';
import * as babel from 'babel-types';
import {ExportDeclaration} from 'babel-types';
import * as clone from 'clone';
import {Document, FileRelativeUrl, PackageRelativeUrl, ParsedJavaScriptDocument, ResolvedUrl} from 'polymer-analyzer';
import {rollup} from 'rollup';

import {assertIsJsDocument, getAnalysisDocument} from './analyzer-utils';
import {serialize} from './babel-utils';
import {AssignedBundle, BundleManifest} from './bundle-manifest';
import {Bundler} from './bundler';
import {getOrSetBundleModuleExportName} from './es6-module-utils';
import {appendUrlPath, ensureLeadingDot, getFileExtension} from './url-utils';
import {generateUniqueIdentifierName, rewriteObject} from './utils';

// const acornImportMetaInject = require('acorn-import-meta/inject');

/**
 * Utility class to rollup/merge ES6 modules code using rollup and rewrite
 * import statements to point to appropriate bundles.
 */
export class Es6Rewriter {
  constructor(
      public bundler: Bundler, public manifest: BundleManifest,
      public bundle: AssignedBundle) {
  }

  /**
   * Produces a module bundle from given source code string and from analysis of
   * imported ES6 modules.
   * @param url The base URL of the module to roll-up.
   * @param code The source code to roll-up.
   * @param document The optional Document which contains the source code to
   * rollup; this is used to get access to the Analyzer's resolutions of module
   * specifiers encountered in the source code if available.
   * TODO(usergenic): Return a valid source-map along with the code.
   */
  async rollup(url: ResolvedUrl, code: string, document?: Document):
      Promise<{code: string, map: undefined}> {
    // This is a synthetic module specifier used to identify the code to rollup
    // and differentiate it from the a request to contents of the document at
    // the actual given url which should load from the analyzer.
    const input = '*bundle*';
    const analysis =
        await this.bundler.analyzer.analyze([...this.bundle.bundle.files]);
    const external: string[] = [];
    for (const [url, bundle] of this.manifest.bundles) {
      if (url !== this.bundle.url) {
        external.push(...[...bundle.files, url]);
      }
    }
    external.push(...this.bundler.excludes);
    // For each document loaded from the analyzer, we build a map of the
    // original specifiers to the resolved URLs since we want to use analyzer
    // resolutions for such things as bare module specifiers.
    const jsImportResolvedUrls = new Map<string, Map<string, ResolvedUrl>>();
    if (document) {
      jsImportResolvedUrls.set(input, this.getEs6ImportResolutions(document));
    }
    const rollupBundle = await rollup({
      input,
      external,
      onwarn: (warning: string) => {},
      treeshake: false,
      plugins: [
        {
          name: 'analyzerPlugin',
          resolveId: (importee: string, importer?: string) => importee,
          load: (id: ResolvedUrl) => {
            // When requesting the main document, just return it as-is.
            if (id === input) {
              return code;
            }

            // When the requested document is part of the bundle, get it
            // from the analysis.
            if (this.bundle.bundle.files.has(id)) {
              const document =
                  assertIsJsDocument(getAnalysisDocument(analysis, id));

              if (!jsImportResolvedUrls.has(id)) {
                jsImportResolvedUrls.set(
                    id, this.getEs6ImportResolutions(document));
              }

              // When Rollup encounters module IDs that are not
              // 'absolute', it tries to be clever by creating a relative
              // path it can use, but it uses `process.cwd()` which is
              // nearly never what we want, and so we have to work around
              // this by converting all module IDs in the returned
              // document to fully resolved URLs.
              const ast = clone(document.parsedDocument.ast);
              this.rewriteEs6SourceUrlsToResolved(
                  ast, jsImportResolvedUrls.get(id)!);
              const serialized = serialize(ast);

              // If the URL of the requested document is the same as the
              // bundle URL or the requested file doesn't use
              // `import.meta` anywhere, we can return it as-is.
              if (this.bundle.url === id ||
                  !document.parsedDocument.contents.includes('import.meta')) {
                return serialized.code;
              }

              // We need to rewrite instances of `import.meta` in the
              // document to preserve its location because `import.meta`
              // is used and the URL has changed as a result of bundling.
              const relativeUrl =
                  ensureLeadingDot(this.bundler.analyzer.urlResolver.relative(
                      this.bundle.url, id));
              const newAst = this._rewriteImportMetaToBundleMeta(
                  generateUniqueIdentifierName(
                      'bundledImportMeta', serialized.code),
                  ast,
                  relativeUrl);
              const newCode = serialize(newAst).code;
              return newCode;
            }
          }
        },
      ],
    });
    const {code: rolledUpCode} = await rollupBundle.generate({
      format: 'es',
      freeze: false,
    });
    // We have to force the extension of the URL to analyze here because
    // inline es6 module document url is going to end in `.html` and the file
    // would be incorrectly analyzed as an HTML document.
    const rolledUpUrl = getFileExtension(url) === '.js' ?
        url :
        appendUrlPath(url, '_inline_es6_module.js');
    const rolledUpDocument = await this.bundler.analyzeContents(
        rolledUpUrl as ResolvedUrl, rolledUpCode);
    const babelFile = assertIsJsDocument(rolledUpDocument).parsedDocument.ast;
    this._rewriteExportStatements(url, babelFile);
    this._rewriteImportStatements(url, babelFile);
    this._deduplicateImportStatements(babelFile);
    const {code: rewrittenCode} = serialize(babelFile);
    return {code: rewrittenCode, map: undefined};
  }

  getEs6ImportResolutions(document: Document): Map<string, ResolvedUrl> {
    const jsImports = document.getFeatures({
      kind: 'js-import',
      imported: false,
      externalPackages: true,
      excludeBackreferences: true,
    });
    const resolutions = new Map<string, ResolvedUrl>();
    for (const jsImport of jsImports) {
      const node = jsImport.astNode.node;
      if ('source' in node) {
        if (node.source && jsImport.document !== undefined) {
          resolutions.set(node.source.value, jsImport.document.url);
        }
      } else if (
          node.callee && node.callee.type + '' === 'Import' &&
          jsImport.document !== undefined) {
        const source = node.arguments[0];
        if (source) {
          if (babel.isStringLiteral(source)) {
            resolutions.set(source.value, jsImport.document.url);
          }
        }
      }
    }
    return resolutions;
  }

  rewriteEs6SourceUrlsToResolved(
      node: babel.Node, jsImportResolvedUrls: Map<string, ResolvedUrl>) {
    const rewriteDeclarationSource = {
      enter(
          path:
              NodePath<babel.ExportAllDeclaration|
                       babel.ExportNamedDeclaration|babel.ImportDeclaration>) {
        const declaration = path.node;
        const source = declaration.source &&
            babel.isStringLiteral(declaration.source) &&
            declaration.source.value;
        if (!source) {
          return;
        }
        const resolution = jsImportResolvedUrls.get(source);
        if (resolution) {
          declaration.source!.value = resolution;
        }
      }
    };
    traverse(node, {
      noScope: true,
      ExportAllDeclaration: rewriteDeclarationSource,
      ExportNamedDeclaration: rewriteDeclarationSource,
      ImportDeclaration: rewriteDeclarationSource,
      CallExpression: {
        enter(path: NodePath<babel.Node>) {
          const callExpression = path.node;
          const callee = callExpression['callee']!;
          const callArguments = callExpression['arguments']!;
          if (!callee || !callArguments || callArguments.length < 1 ||
              !babel.isStringLiteral(callArguments[0]!)) {
            return;
          }
          if (callee.type === 'Import') {
            callArguments[0].value =
                jsImportResolvedUrls.get(callArguments[0].value);
          }
        }
      }
    });
  }

  /**
   * Attempts to reduce the number of distinct import declarations by combining
   * those referencing the same source into the same declaration. Results in
   * deduplication of imports of the same item as well.  It should NOT touch
   * dynamic imports at all.
   *
   * Before:
   *     import {a} from './module-1.js';
   *     import {b} from './module-1.js';
   *     import {c} from './module-2.js';
   *     import('./module-3.js');
   *     import('./module-3.js');
   * After:
   *     import {a,b} from './module-1.js';
   *     import {c} from './module-2.js';
   *     import('./module-3.js');
   *     import('./module-3.js');
   */
  private _deduplicateImportStatements(node: babel.Node) {
    const importDeclarations = new Map<string, babel.ImportDeclaration>();
    traverse(node, {
      noScope: true,
      ImportDeclaration: {
        enter(path: NodePath<babel.ImportDeclaration>) {
          const importDeclaration = path.node;
          const source = babel.isStringLiteral(importDeclaration.source) &&
              importDeclaration.source.value;
          if (!source) {
            return;
          }
          const hasNamespaceSpecifier = importDeclaration.specifiers.some(
              (s) => babel.isImportNamespaceSpecifier(s));
          const hasDefaultSpecifier = importDeclaration.specifiers.some(
              (s) => babel.isImportDefaultSpecifier(s));
          if (!importDeclarations.has(source) && !hasNamespaceSpecifier &&
              !hasDefaultSpecifier) {
            importDeclarations.set(source, importDeclaration);
          } else if (importDeclarations.has(source)) {
            const existingDeclaration = importDeclarations.get(source)!;
            for (const specifier of importDeclaration.specifiers) {
              existingDeclaration.specifiers.push(specifier);
            }
            path.remove();
          }
        }
      }
    });
  }

  /**
   * Rewrite export declarations source URLs to reference the bundle URL for
   * bundled files.
   */
  private _rewriteExportStatements(baseUrl: ResolvedUrl, node: babel.Node) {
    const this_ = this;
    traverse(node, {
      noScope: true,
      ExportNamedDeclaration: {
        enter(path: NodePath<babel.ExportNamedDeclaration>) {
          const exportNamedDeclaration = path.node;
          if (!exportNamedDeclaration.source ||
              !babel.isStringLiteral(exportNamedDeclaration.source)) {
            // We can't rewrite a source if there isn't one or if it isn't a
            // string literal in the first place.
            return;
          }
          const source = exportNamedDeclaration.source.value as ResolvedUrl;
          const sourceBundle = this_.manifest.getBundleForFile(source);
          // If there is no bundle associated with the export from statement
          // then the URL is not bundled (perhaps it was excluded) so we will
          // just ensure the URL is converted back to a relative URL.
          if (!sourceBundle) {
            exportNamedDeclaration.source.value = ensureLeadingDot(
                this_.bundler.analyzer.urlResolver.relative(baseUrl, source));
            return;
          }
          exportNamedDeclaration.source.value =
              ensureLeadingDot(this_.bundler.analyzer.urlResolver.relative(
                  baseUrl, sourceBundle.url));
        }
      }
    });
  }

  /**
   * Rewrite import declarations source URLs to reference the bundle URL for
   * bundled files and import names to correspond to names as exported by
   * bundles.
   */
  private _rewriteImportStatements(baseUrl: ResolvedUrl, node: babel.Node) {
    const this_ = this;
    traverse(node, {
      noScope: true,
      // Dynamic import() syntax doesn't have full type support yet, so we
      // have to use generic `enter` and walk all nodes until that's fixed.
      // TODO(usergenic): Switch this to the `Import: { enter }` style
      // after dynamic imports fully supported.
      enter(path: NodePath) {
        if (path.node.type === 'Import') {
          this_._rewriteDynamicImport(baseUrl, node, path);
        }
      },
    });

    traverse(node, {
      noScope: true,
      ImportDeclaration: {
        enter(path: NodePath<babel.ImportDeclaration>) {
          const importDeclaration = path.node;
          if (!babel.isStringLiteral(importDeclaration.source)) {
            // We can't actually handle values which are not string literals,
            // so we'll skip them.
            return;
          }
          const source = importDeclaration.source.value as ResolvedUrl;
          const sourceBundle = this_.manifest.getBundleForFile(source);
          // If there is no import bundle, then this URL is not bundled (maybe
          // excluded or something) so we should just ensure the URL is
          // converted back to a relative URL.
          if (!sourceBundle) {
            importDeclaration.source.value = ensureLeadingDot(
                this_.bundler.analyzer.urlResolver.relative(baseUrl, source));
            return;
          }
          for (const specifier of importDeclaration.specifiers) {
            if (babel.isImportSpecifier(specifier)) {
              this_._rewriteImportSpecifierName(
                  specifier, source, sourceBundle);
            }
            if (babel.isImportDefaultSpecifier(specifier)) {
              this_._rewriteImportDefaultSpecifier(
                  specifier, source, sourceBundle);
            }
            if (babel.isImportNamespaceSpecifier(specifier)) {
              this_._rewriteImportNamespaceSpecifier(
                  specifier, source, sourceBundle);
            }
          }
          importDeclaration.source.value =
              ensureLeadingDot(this_.bundler.analyzer.urlResolver.relative(
                  baseUrl, sourceBundle.url));
        }
      }
    });
  }

  /**
   * Extends dynamic import statements to extract the explicitly namespace
   * export for the imported module.
   *
   * Before:
   *     import('./module-a.js')
   *         .then((moduleA) => moduleA.doSomething());
   *
   * After:
   *     import('./bundle_1.js')
   *         .then(bundle => bundle && bundle.$moduleA || {})
   *         .then((moduleA) => moduleA.doSomething());
   */
  private _rewriteDynamicImport(
      baseUrl: ResolvedUrl, root: babel.Node, importNodePath: NodePath) {
    if (!importNodePath) {
      return;
    }
    const importCallExpression = importNodePath.parent;
    if (!importCallExpression ||
        !babel.isCallExpression(importCallExpression)) {
      return;
    }
    const importCallArgument = importCallExpression.arguments[0];
    if (!babel.isStringLiteral(importCallArgument)) {
      return;
    }
    const sourceUrl = importCallArgument.value;
    const resolvedSourceUrl = this.bundler.analyzer.urlResolver.resolve(
        baseUrl, sourceUrl as FileRelativeUrl);
    if (!resolvedSourceUrl) {
      return;
    }
    const sourceBundle = this.manifest.getBundleForFile(resolvedSourceUrl);
    // TODO(usergenic): To support *skipping* the rewrite, we need a way to
    // identify whether a bundle contains a single top-level module or is a
    // merged bundle with multiple top-level modules.
    let exportName;
    if (sourceBundle) {
      exportName =
          getOrSetBundleModuleExportName(sourceBundle, resolvedSourceUrl, '*');
    }
    // If there's no source bundle or the namespace export name of the bundle
    // is just '*', then we don't need to append a .then() to transform the
    // return value of the import().  Lets just rewrite the URL to be a
    // relative path and exit.
    if (!sourceBundle || exportName === '*') {
      const relativeSourceUrl =
          ensureLeadingDot(this.bundler.analyzer.urlResolver.relative(
              baseUrl, resolvedSourceUrl));
      importCallArgument.value = relativeSourceUrl;
      return;
    }
    // Rewrite the URL to be a relative path to the bundle.
    const relativeSourceUrl = ensureLeadingDot(
        this.bundler.analyzer.urlResolver.relative(baseUrl, sourceBundle.url));
    importCallArgument.value = relativeSourceUrl;
    const importCallExpressionParent = importNodePath.parentPath.parent!;
    if (!importCallExpressionParent) {
      return;
    }
    const thenifiedCallExpression = babel.callExpression(
        babel.memberExpression(
            clone(importCallExpression), babel.identifier('then')),
        [babel.arrowFunctionExpression(
            [babel.identifier('bundle')],
            babel.logicalExpression(
                '||',
                babel.logicalExpression(
                    '&&',
                    babel.identifier('bundle'),
                    babel.memberExpression(
                        babel.identifier('bundle'),
                        babel.identifier(exportName))),
                babel.objectExpression([])))]);
    rewriteObject(importCallExpression, thenifiedCallExpression);
  }

  /**
   * Changes an import specifier to use the exported name defined in the bundle.
   *
   * Before:
   *     import {something} from './module-a.js';
   *
   * After:
   *     import {something_1} from './bundle_1.js';
   */
  private _rewriteImportSpecifierName(
      specifier: babel.ImportSpecifier, source: ResolvedUrl,
      sourceBundle: AssignedBundle) {
    const originalExportName = specifier.imported.name;
    const exportName = getOrSetBundleModuleExportName(
        sourceBundle, source, originalExportName);
    specifier.imported.name = exportName;
  }

  /**
   * Changes an import specifier to use the exported name for original module's
   * default as defined in the bundle.
   *
   * Before:
   *     import moduleA from './module-a.js';
   *
   * After:
   *     import {$moduleADefault} from './bundle_1.js';
   */
  private _rewriteImportDefaultSpecifier(
      specifier: babel.ImportDefaultSpecifier, source: ResolvedUrl,
      sourceBundle: AssignedBundle) {
    const exportName =
        getOrSetBundleModuleExportName(sourceBundle, source, 'default');
    // No rewrite necessary if default is the name, since this indicates there
    // was no rewriting or bundling of the default export.
    if (exportName === 'default') {
      return;
    }
    // tslint:disable-next-line: no-any Look into NodePath.replace instead.
    const importSpecifier = specifier as any as babel.ImportSpecifier;
    Object.assign(
        importSpecifier,
        {type: 'ImportSpecifier', imported: babel.identifier(exportName)});
  }

  /**
   * Changes an import specifier to use the exported name for original module's
   * namespace as defined in the bundle.
   *
   * Before:
   *     import * as moduleA from './module-a.js';
   *
   * After:
   *     import {$moduleA} from './bundle_1.js';
   */
  private _rewriteImportNamespaceSpecifier(
      specifier: babel.ImportNamespaceSpecifier, source: ResolvedUrl,
      sourceBundle: AssignedBundle) {
    const exportName =
        getOrSetBundleModuleExportName(sourceBundle, source, '*');
    // No rewrite necessary if * is the name, since this indicates there was
    // no bundling of the namespace.
    if (exportName === '*') {
      return;
    }
    // tslint:disable-next-line: no-any Look into NodePath.replace instead.
    const importSpecifier = specifier as any as babel.ImportSpecifier;
    Object.assign(
        importSpecifier,
        {type: 'ImportSpecifier', imported: babel.identifier(exportName)});
  }

  private _rewriteImportMetaToBundleMeta(
      bundledImportMetaIdentifierName: string, moduleFile: babel.File,
      relativeUrl: FileRelativeUrl): babel.File {
    // Generate a stand-in for any local references to import.meta...
    // ```javascript
    // const bundledImportMeta = {
    //    ...import.meta,
    //    url: new URL(${ relativeUrl }, import.meta.url).href
    // };
    // ```
    // TODO(usergenic): Consider migrating this AST production mishmash into
    // the `ast` tagged template literal available like this:
    // https://github.com/Polymer/tools/blob/master/packages/build/src/babel-plugin-dynamic-import-amd.ts#L64
    const bundledImportMetaDeclaration = babel.variableDeclaration(
        //
        'const',
        [
          //
          babel.variableDeclarator(
              babel.identifier(bundledImportMetaIdentifierName),
              babel.objectExpression([
                babel.spreadProperty(babel.memberExpression(
                    babel.identifier('import'), babel.identifier('meta'))),
                babel.objectProperty(
                    babel.identifier('url'),
                    babel.memberExpression(
                        babel.newExpression(
                            babel.identifier('URL'),
                            [
                              //
                              babel.stringLiteral(relativeUrl),
                              babel.memberExpression(
                                  babel.memberExpression(
                                      babel.identifier('import'),
                                      babel.identifier('meta')),
                                  babel.identifier('url'))
                            ]),
                        babel.identifier('href')))
              ]))
        ]);
    const newModuleFile = clone(moduleFile);
    traverse(newModuleFile, {
      noScope: true,
      MetaProperty: {
        enter(path: NodePath<babel.MetaProperty>) {
          const metaProperty = path.node;
          if (metaProperty.meta.name !== 'import' &&
              metaProperty.property.name !== 'meta') {
            // We're specifically looking for instances of `import.meta` so
            // ignore any other meta properties.
            return;
          }
          const bundledImportMeta =
              babel.identifier(bundledImportMetaIdentifierName);
          path.replaceWith(bundledImportMeta);
        },
      },
    });
    newModuleFile.program.body.unshift(bundledImportMetaDeclaration);
    return newModuleFile;
  }
}
