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
import * as fs from 'mz/fs';
import * as parse5 from 'parse5';
import * as path from 'path';
import * as recast from 'recast';

import {Analyzer, FSUrlLoader, PackageUrlResolver, Document, ParsedJavaScriptDocument, Namespace, Analysis, Import} from 'polymer-analyzer';
import {BlockStatement, Program, ExpressionStatement, Statement, ModuleDeclaration, Expression, Node, ObjectExpression, FunctionExpression, Identifier, AssignmentExpression} from 'estree';

import jsc = require('jscodeshift');

const astTypes = require('ast-types');
const mkdirp = require('mkdirp');

const analyzer = new Analyzer({
  urlLoader: new FSUrlLoader(process.cwd()),
  urlResolver: new PackageUrlResolver(),
});

const _isInTestRegex = /(\b|\/|\\)(test)(\/|\\)/;
const isNotTest = (d: Document) => !_isInTestRegex.test(d.url);

const _isInBowerRegex = /(\b|\/|\\)(bower_components)(\/|\\)/;
const _isInNpmRegex = /(\b|\/|\\)(node_modules)(\/|\\)/;
const isNotExternal = (d: Document) => !_isInBowerRegex.test(d.url) && !_isInNpmRegex.test(d.url);


function generatePackageJson(bowerJson: any, npmName: string, npmVersion?: string) {
  return {
    name: npmName,
    flat: true,
    version: npmVersion || bowerJson.version,
    description: bowerJson.description,
    author: bowerJson.author,
    contributors: bowerJson.contributors || bowerJson.authors,
    keywords: bowerJson.keywords,
    main: (typeof bowerJson.main === 'string') ? bowerJson.main : undefined,
    repository: bowerJson.repository,
    homepage: bowerJson.homepage,
    dependencies: {},
    devDependencies: {}
  };
}


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

type ConvertPackageOptions = AnalysisConverterOptions & {

  /**
   * The directory to write converted JavaScript files to.
   */
  outDir?: string;

  /**
   * The npm package name to use in package.json
   */
  packageName?: string;

  npmVersion?: string;
};

/**
 * Converts an entire package from HTML imports to JS modules
 */
export async function convertPackage(options: ConvertPackageOptions = {}) {
  const outDir = options && (options.outDir) || 'js_out';
  const outDirResolved = path.resolve(process.cwd(), outDir);
  console.log(`Out directory: ${outDirResolved}`);

  try {
    await fs.mkdir(outDirResolved);
  } catch (e) {
    if (e.errno !== -17) { // directory exists
      console.error(e);
    }
  }

  const analysis = await analyzer.analyzePackage();

  // TODO(justinfagnani): These setting are only good for Polymer core and should be
  // extracted into a config file
  const npmPackageName = options.packageName || '@polymer/polymer';
  const npmPackageVersion = options.npmVersion;
  const converter = new AnalysisConverter(analysis, {
    rootModuleName: options.rootModuleName || 'Polymer',
    excludes: options.excludes || [
      'lib/utils/boot.html',
      'lib/elements/dom-module.html',
    ],
    referenceExcludes: options.referenceExcludes || [
      'Polymer.DomModule',
      'Polymer.log',
      'Polymer.sanitizeDOMValue'
    ],
    mutableExports: options.mutableExports || {
      'Polymer.telemetry': ['instanceCount'],
    },
  });

  try {
    const results = await converter.convert();
    for (const [jsUrl, newSource] of results!) {
      const outPath = path.resolve(outDirResolved, jsUrl);
      const jsDir = path.dirname(outPath);
      // console.log(`writing ${outPath}`);
      mkdirp.sync(jsDir);
      // console.log(`created dir ${jsDir}`);
      await fs.writeFile(outPath, newSource);
    }
  } catch (e) {
    console.log('error in codebase conversion');
    console.error(e);
  }

  try {
    const bowerJsonPath = path.resolve('bower.json');
    const bowerJson = await fs.readFile(bowerJsonPath);
    const packageJsonPath = path.resolve(outDir, 'package.json');
    const packageJson = generatePackageJson(bowerJson, npmPackageName, npmPackageVersion);
    await fs.writeFile(packageJsonPath, JSON.stringify(packageJson, undefined, 2));
  } catch (e) {
    console.log('error in bower.json -> package.json conversion');
    console.error(e);
  }

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
 * Converts a Document and its dependencies.
 */
class DocumentConverter {

  jsUrl: string;
  module: JsModule;
  analysisConverter: AnalysisConverter;
  document: Document;
  scriptDocument: Document;
  program: Program;
  currentStatementIndex = 0;
  _mutableExports: {[namespaceName: string]: string[]};

  constructor(analysisConverter: AnalysisConverter, document: Document) {
    this.analysisConverter = analysisConverter;
    this._mutableExports = <any>Object.assign({}, this.analysisConverter._mutableExports);
    this.document = document;
    this.jsUrl = htmlUrlToJs(document.url);
    this.module = {
      url: this.jsUrl,
      source: '',
      exports: new Set<string>(),
      importedReferences: new Map<string, Set<string>>(),
    };
    analysisConverter.modules.set(this.jsUrl, this.module);

    const scripts = this.document.getFeatures({kind: 'js-document'});
    if (scripts.size === 0) {
      this.program = jsc.program([]);
    } else if (scripts.size > 1) {
      // TODO(justinfagnani): better warning wording, plus actionable reccomendation or
      // decide on some default handling of multiple scripts.
      console.log('multiple scripts');
      return;
    } else {
      this.scriptDocument = scripts.values().next().value;
      const jsDoc = this.scriptDocument.parsedDocument as ParsedJavaScriptDocument;
      const file = recast.parse(jsDoc.contents);
      this.program = file.program;
    }
  }

  /**
   * Returns the HTML Imports of a document, except imports to documents
   * specifically excluded in the AnalysisConverter.
   *
   * Note: Imports that are not found are not returned by the analyzer.
   */
  getHtmlImports() {
    return Array.from(this.document.getFeatures({kind: 'html-import'}))
        .filter((f: Import) => !this.analysisConverter._excludes.has(f.url));
  }

  /**
   * Adds an export to this module's metadata and to the AnalysisConverter's
   * namespacedExports index.
   */
  addExport(namespaceName: string, name: string) {
    this.module.exports.add(name);
    this.analysisConverter.namespacedExports.set(namespaceName, {
      url: this.jsUrl,
      name,
    });
  }

  convert() {
    this.convertDependencies();
    this.unwrapModuleBody();
    this.rewriteNamespacedReferences();
    this.addJsImports();
    this.inlineTemplates();

    let localNamespaceName: string|undefined;
    let namespaceName: string|undefined;

    // Walk through all top-level statements and replace namespace assignments
    // with module exports.
    while (this.currentStatementIndex < this.program.body.length) {
      const statement = this.program.body[this.currentStatementIndex] as Statement;
      const exported = getExport(statement, this.analysisConverter.rootModuleName);

      if (exported !== undefined) {
        const {namespace, value} = exported;
        namespaceName = namespace.join('.');

        if (this.isNamespace(statement) && value.type === 'ObjectExpression') {
          this.rewriteNamespaceObject(namespaceName, value, statement);
          localNamespaceName = namespaceName;
        } else if (value.type === 'Identifier') {
          // An 'export' of the form:
          // Polymer.Foo = Foo;
          // TODO(justinfagnani): generalize to handle namespaces and other declarations
          const localName = value as Identifier;

          const features = this.document.getFeatures({id: namespaceName});
          // TODO(fks) 06-06-2017: '!' required below due to Typscript bug, remove when fixed
          const referencedFeature = Array.from(features).find((f) => f.identifiers.has(namespaceName!));

          if (referencedFeature && referencedFeature.kinds.has('namespace')) {
            // Polymer.X = X; where X is previously defined as a namespace

            // Find the namespace node and containing statement
            const namespaceFeature = referencedFeature as Namespace;
            const nsParent = this.getNode(namespaceFeature.astNode) as Statement;
            if (nsParent == null) {
              throw new Error(`can't find associated node for namespace`);
            }
            let nsNode: ObjectExpression;
            if (nsParent.type === 'VariableDeclaration') {
              // case: const n = {...}
              nsNode = nsParent.declarations[0].init as ObjectExpression;
            } else {
              // case: n = {...}
              // assumes an assignment statement!
              const expression = (nsParent as ExpressionStatement).expression as AssignmentExpression;
              nsNode = expression.right as ObjectExpression;
            }
            this.rewriteNamespaceObject(namespaceName, nsNode, nsParent);

            // Remove the namespace assignment
            this.program.body.splice(this.currentStatementIndex, 1);
            // Adjust current index since we removed a statement
            this.currentStatementIndex--;
          } else {
            // Not a namespace, fallback to a named export
            // We could probably do better for referenced declarations, ie move the export
            // to the declaration
            const exportedName = jsc.identifier(namespace[namespace.length - 1]) as Identifier;
            this.program.body[this.currentStatementIndex] = jsc.exportNamedDeclaration(
              null, // declaration
              [jsc.exportSpecifier(localName, exportedName)]);
            this.addExport(namespaceName, exportedName.name);
          }
        } else if (isDeclaration(value)) {
          // TODO (justinfagnani): remove this case? Is it used? Add a test
          this.program.body[this.currentStatementIndex] = jsc.exportDeclaration(
            false, // default
            value);
        } else {
          const name = namespace[namespace.length - 1];
          this.program.body[this.currentStatementIndex] = jsc.exportNamedDeclaration(
            jsc.variableDeclaration(
              'const',
              [jsc.variableDeclarator(jsc.identifier(name), value)]
            ));
          this.addExport(namespaceName, name);
        }
      } else if (this.isNamespace(statement) && statement.type === 'VariableDeclaration') {
        // Local namespace declaration, like:
        // /** @namespace */ const Foo = {};
        // Set the localNamespacename so we can rewrite internal references
        const declarator = statement.declarations[0];
        if (declarator.id.type === 'Identifier') {
          localNamespaceName = declarator.id.name;
        }
      } else if (localNamespaceName) {
        const namespaceAssignment = getExport(statement, localNamespaceName);

        if (namespaceAssignment !== undefined) {
          const {namespace, value} = namespaceAssignment;
          const name = namespace[namespace.length - 1];
          namespaceName = namespace.join('.');

          this.program.body[this.currentStatementIndex] = jsc.exportNamedDeclaration(
            jsc.variableDeclaration(
              'const',
              [jsc.variableDeclarator(jsc.identifier(name), value)]
            ));
          this.addExport(namespaceName, name);
        }
      }
      this.currentStatementIndex++;
    }

    this.rewriteNamespaceThisReferences(namespaceName);
    this.rewriteLocalNamespacedReferences(localNamespaceName);
    this.rewriteLocalNamespacedReferences(namespaceName);

    this.module.source = recast.print(this.program, {
      quote: 'single',
      wrapColumn: 80,
      tabWidth: 2,
    }).code + '\n';
  }

  inlineTemplates() {
    if (this.scriptDocument === undefined) {
      return;
    }
    const elements = this.scriptDocument.getFeatures({'kind': 'polymer-element'});
    for (const element of elements) {
      const domModule = element.domModule;
      if (domModule === undefined) {
        continue;
      }
      const template = dom5.query(domModule, (e) => e.tagName === 'template');
      if (template === null) {
        continue;
      }
      const templateText = parse5.serialize((template as any).content).trim();
      const node = this.getNode(element.astNode)!;

      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        // A Polymer 2.0 class-based element
        node.body.body.splice(0, 0, jsc.methodDefinition(
          'get',
          jsc.identifier('template'),
          jsc.functionExpression(
            null,
            [],
            jsc.blockStatement([jsc.returnStatement(jsc.literal(templateText))]))
        ));
      } else if (node.type === 'CallExpression') {
        // A Polymer hybrid/legacy factory function element
        (node.arguments[0] as ObjectExpression).properties.splice(0, 0, jsc.property(
          'init',
          jsc.identifier('_template'),
          jsc.literal(templateText)));
      }
    }
  }

  /**
   *  Convert dependencies first, so we know what exports they have.
   */
  convertDependencies() {
    const htmlImports = this.getHtmlImports();
    for (const htmlImport of htmlImports) {
      const jsUrl = htmlUrlToJs(htmlImport.url, this.document.url);
      if (this.analysisConverter.modules.has(jsUrl)) {
        continue;
      }
      this.analysisConverter.convertDocument(htmlImport.document);
    }
  }

  /**
   * Rewrite namespaced references (ie, Polymer.Element) to the imported name (ie, Element).
   *
   * Returns a Map of imports used for each module so import declarations can be rewritten
   * correctly.
   */
  rewriteNamespacedReferences() {
    const analysisConverter = this.analysisConverter;
    const module = analysisConverter.modules.get(this.jsUrl)!;
    const importedReferences = module.importedReferences;
    const baseUrl = this.document.url;

    astTypes.visit(this.program, {
      visitMemberExpression(path: any) {
        const memberPath = getMemberPath(path.node);
        if (memberPath) {
          const memberName = memberPath.join('.');

          if (analysisConverter._referenceExcludes.has(memberName)) {
            path.replace(jsc.identifier('undefined'));
          } else {
            const moduleExport = analysisConverter.namespacedExports.get(memberName);
            if (moduleExport) {
              // Store the imported reference to we can add it to the import statement
              const moduleJsUrl = htmlUrlToJs(moduleExport.url, baseUrl);
              let moduleImportedNames = importedReferences.get(moduleJsUrl);
              if (moduleImportedNames === undefined) {
                moduleImportedNames = new Set<string>();
                importedReferences.set(moduleJsUrl, moduleImportedNames);
              }
              moduleImportedNames.add(moduleExport.name);

              // replace the member expression
              if (moduleExport.name === '*') {
                const jsModule = analysisConverter.modules.get(moduleExport.url)!;
                path.replace(jsc.identifier(getModuleId(jsModule.url)));
              } else {
                path.replace(jsc.identifier(getImportAlias(moduleExport.name)));
              }
            }
          }
        }
        this.traverse(path);
      }
    });
  }

  /**
   * Rewrites local references to a namespace member, ie:
   *
   * const NS = {
   *   foo() {}
   * }
   * NS.foo();
   *
   * to:
   *
   * export foo() {}
   * foo();
   */
  rewriteLocalNamespacedReferences(namespaceName?: string) {
    if (namespaceName === undefined) {
      return;
    }
    astTypes.visit(this.program, {
      visitMemberExpression(path: any) {
        const memberPath = getMemberPath(path.node);
        const memberName = memberPath && memberPath.slice(0, -1).join('.');
        if (memberName && memberName === namespaceName) {
          path.replace(path.node.property);
          return false;
        }
        // Keep looking, this MemberExpression could still contain the
        // MemberExpression that we are looking for.
        this.traverse(path);
        return;
      }
    });
  }

  /**
   * Rewrite `this` references that refer to the namespace object. Replace with
   * an explicit reference to the namespace. This simplifies the rest of our
   * transform pipeline by letting it assume that all namespace references
   * are explicit.
   *
   * NOTE(fks): References to the namespace object still need to be corrected
   * after this step, so timing is important: Only run after exports have
   * been created, but before all namespace references are corrected.
   */
  rewriteNamespaceThisReferences(namespaceName?: string) {
    if (namespaceName === undefined) {
      return;
    }
    astTypes.visit(this.program, {
      visitExportNamedDeclaration: (path: any) => {
        if (path.node.declaration && path.node.declaration.type === 'FunctionDeclaration') {
          this.rewriteSingleScopeThisReferences(path.node.declaration.body, namespaceName);
        }
        return false;
      },
      visitExportDefaultDeclaration: (path: any) => {
        if (path.node.declaration && path.node.declaration.type === 'FunctionDeclaration') {
          this.rewriteSingleScopeThisReferences(path.node.declaration.body, namespaceName);
        }
        return false;
      },
    });
  }

  /**
   * Rewrite `this` references to the explicit namespaceReference identifier
   * within a single BlockStatement. Don't traverse deeper into new scopes.
   */
  rewriteSingleScopeThisReferences(blockStatement: BlockStatement, namespaceReference: string) {
    astTypes.visit(blockStatement, {
      visitFunctionExpression(_path: any) {
        // Don't visit into new scopes
        return false;
      },
      visitFunctionDeclaration(_path: any) {
        // Don't visit into new scopes
        return false;
      },
      visitThisExpression(path: any) {
        path.replace(jsc.identifier(namespaceReference));
        return false;
      },
    });
  }

  /**
   * Injects JS imports at the top of the program.
   */
  addJsImports() {
    const htmlImports = this.getHtmlImports();
    const baseUrl = this.document.url;

    // Rewrite HTML Imports to JS imports
    const jsImportDeclarations:any[] = [];
    for (const htmlImport of htmlImports) {
      const jsUrl = htmlUrlToJs(htmlImport.url, baseUrl);
      const specifierNames = this.module.importedReferences.get(jsUrl);
      const specifierNamesArray = specifierNames ? Array.from(specifierNames) : [];
      const hasNamespaceReference = specifierNamesArray.some((s) => s === '*');
      const namedSpecifiers = specifierNamesArray
          .filter((s) => s !== '*')
          .map((s) => jsc.importSpecifier(jsc.identifier(s), jsc.identifier(getImportAlias(s))));
      // If a module namespace was referenced, create a new namespace import
      if (hasNamespaceReference) {
        jsImportDeclarations.push(jsc.importDeclaration(
          [jsc.importNamespaceSpecifier(jsc.identifier(getModuleId(jsUrl)))],
          jsc.literal(jsUrl)));
      }
      // If any named imports were referenced, create a new import for all named
      // members. If `namedSpecifiers` is empty but a namespace wasn't imported
      // either, then still add an empty importDeclaration to trigger the load.
      if (namedSpecifiers.length > 0 || !hasNamespaceReference) {
        jsImportDeclarations.push(jsc.importDeclaration(
          namedSpecifiers,
          jsc.literal(jsUrl)));
      }
    }
    this.program.body.splice(0, 0, ...jsImportDeclarations);
    this.currentStatementIndex += jsImportDeclarations.length;
  }

  /**
   * Returns the implied module body of a script - if there's a top-level IIFE, it
   * assumes that is an intentionally scoped ES5 module body.
   */
  unwrapModuleBody() {
    if (this.program.body.length === 1 &&
        this.program.body[0].type === 'ExpressionStatement') {
      const expression = (this.program.body[0] as ExpressionStatement).expression;
      if (expression.type === 'CallExpression') {
        const callee = expression.callee;
        if (callee.type === 'FunctionExpression') {
          const body = callee.body.body;
          if (body.length > 1 && isUseStrict(body[0])) {
            this.program.body = body.slice(1);
          } else {
            this.program.body = body;
          }
        }
      }
    }
  }

  /**
   * Rewrites a namespace object as a set of exports.
   *
   * @param name the dot-separated name of the namespace
   * @param body the ObjectExpression body of the namespace
   * @param statement the statement, to be replaced, that contains the namespace
   */
  rewriteNamespaceObject(name: string, body: ObjectExpression, statement: Statement) {
    const mutableExports = this._mutableExports[name];
    const exports = getNamespaceExports(body, mutableExports);

    // Replace original namespace statement with new exports
    const nsIndex = this.program.body.indexOf(statement);
    this.program.body.splice(nsIndex, 1, ...exports.map((e) => e.node as Statement));
    this.currentStatementIndex += exports.length - 1;

    exports.forEach((e) => {
      this.addExport(`${name}.${e.name}`, e.name);
    });
    this.addExport(name, '*');
  }

  isNamespace(node: Node) {
    if (this.scriptDocument == null) {
      return false;
    }
    const namespaces = this.scriptDocument.getFeatures({kind: 'namespace'});
    for (const namespace of namespaces) {
      if (sourceLocationsEqual(namespace.astNode, node)) {
        return true;
      }
    }
    return false;
  }

  getNode(node: Node) {
    let associatedNode: Node|undefined;

    astTypes.visit(this.program, {
      visitNode(path: any): any {
        if (sourceLocationsEqual(path.node, node)) {
          associatedNode = path.node;
          return false;
        }
        this.traverse(path);
      }
    });

    return associatedNode;
  }

}

/**
 * Returns export declarations for each of a namespace objects members.
 */
function getNamespaceExports(namespace: ObjectExpression, mutableExports?: string[]) {
  const exports: {name: string, node: Node}[] = [];

  for (const {key, value}  of namespace.properties) {
    if (key.type !== 'Identifier') {
      console.warn(`unsupported namespace property type ${key.type}`);
      continue;
    }
    const name = (key as Identifier).name;
    if (value.type === 'ObjectExpression' || value.type === 'ArrayExpression' || value.type === 'Literal') {
      const isMutable = !!(mutableExports && mutableExports.includes(name));
      exports.push({
        name,
        node: jsc.exportNamedDeclaration(
          jsc.variableDeclaration(
            isMutable ? 'let' : 'const',
            [jsc.variableDeclarator(key, value)]))
      });
    } else if (value.type === 'FunctionExpression') {
      const func = value as FunctionExpression;
      exports.push({
        name,
        node: jsc.exportNamedDeclaration(
          jsc.functionDeclaration(
            key, //id
            func.params,
            func.body,
            func.generator
          ))
      });
    } else if (value.type === 'ArrowFunctionExpression') {
      exports.push({
        name,
        node: jsc.exportNamedDeclaration(
          jsc.variableDeclaration(
            'const',
            [jsc.variableDeclarator(key, value)]
          ))
      });
    } else if (value.type === 'Identifier') {
      exports.push({
        name,
        node: jsc.exportNamedDeclaration(
          null,
          [jsc.exportSpecifier(jsc.identifier(name), jsc.identifier(name))]
        ),
      });
    } else {
      console.warn('Namespace property not handled:', name, value);
    }
  }

  return exports;
}

/**
 * Returns true if a statement is the literal "use strict".
 */
function isUseStrict(statement: Statement) {
  return statement.type === 'ExpressionStatement'
      && statement.expression.type === 'Literal'
      && statement.expression.value === 'use strict';
}

/**
 * Returns true if a node is a class or function declaration
 */
function isDeclaration(node: Node) {
  const type = node.type;
  return type === 'ClassDeclaration';
}

/**
 * If a statement appears to be an export, returns the exported declaration.
 *
 * Implied exports are assignment expressions where the left hand side matches
 * some predicate to be refined later :)
 *
 * @param moduleRoot If specified
 */
function getExport(statement: Statement | ModuleDeclaration, rootModuleName?: string): {namespace: string[], value: Expression} |undefined {
  if (!(statement.type === 'ExpressionStatement'
      && statement.expression.type === 'AssignmentExpression')) {
    return undefined;
  }
  const assignment = statement.expression;
  if (!(assignment.left.type === 'MemberExpression')) {
    return undefined;
  }

  const namespace = getMemberPath(assignment.left);

  if (namespace !== undefined && namespace[0] === rootModuleName) {
    return {
      namespace,
      value: assignment.right,
    };
  }
  return undefined;
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
    jsUrl = path.relative(path.dirname(from), jsUrl);
  }
  if (!jsUrl.startsWith('.') && !jsUrl.startsWith('/')) {
    jsUrl = './' + jsUrl;
  }
  return jsUrl;
}

/**
 * Get the import alias for an imported member. Useful when generating an
 * import statement or a reference to an imported member.
 */
function getImportAlias(importId: string) {
  return '$' + importId;
}

/**
 * Get the import name for an imported module object. Useful when generating an
 * import statement, or a reference to an imported module object.
 */
function getModuleId(url: string) {
  const baseName = path.basename(url);
  const lastDotIndex = baseName.lastIndexOf('.');
  const mainName = baseName.substring(0, lastDotIndex);
  return '$$' + dashToCamelCase(mainName);
}

function dashToCamelCase(s: string) {
  return s.replace(/-[a-z]/g, (m) => m[1].toUpperCase())
}

function sourceLocationsEqual(a: Node, b: Node): boolean {
  if (a === b) {
    return true;
  }
  const aLoc = a.loc;
  const bLoc = b.loc;
  if (aLoc === bLoc) {
    return true;
  }
  if (aLoc == null || bLoc == null) {
    return false;
  }
  return aLoc.start.column === bLoc.start.column
      && aLoc.start.line === bLoc.start.line
      && aLoc.end.column === bLoc.end.column
      && aLoc.end.line === bLoc.end.line;
}
