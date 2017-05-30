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

import * as escodegen from 'escodegen';
import * as fs from 'mz/fs';
import * as path from 'path';
import {Analyzer, FSUrlLoader, PackageUrlResolver, Document, ParsedJavaScriptDocument, Namespace, Analysis, Import} from 'polymer-analyzer';
import {Program, ExpressionStatement, Statement, ModuleDeclaration, Expression, Node, ObjectExpression, FunctionExpression, Identifier} from 'estree';

const astTypes = require('ast-types');
const mkdirp = require('mkdirp');
const J = require('jscodeshift');

const analyzer = new Analyzer({
  urlLoader: new FSUrlLoader(process.cwd()),
  urlResolver: new PackageUrlResolver(),
});

const isInTests = /(\b|\/|\\)(test)(\/|\\)/;
const isNotTest = (d: Document) => !isInTests.test(d.url);

const isInBower = /(\b|\/|\\)(bower_components)(\/|\\)/;
const isNotExternal = (d: Document) => !isInBower.test(d.url);


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
  url: string;
  source: string;
  exports: Set<string>;
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
   * Map of namespaced id to module URL + exported name
   */
  namespacedExports: Map<string, JsExport>;
}

/**
 * Converts an entire package from HTML imports to JS modules
 */
export async function convertPackage() {
  const outDir = path.resolve(process.cwd(), 'js_out');
  console.log(`Out directory: ${outDir}`);

  try {
    await fs.mkdir(outDir);
  } catch (e) {
    console.error(e);
  }

  const analysis = await analyzer.analyzePackage();
  const converter = new AnalysisConverter(analysis);
  const results = await converter.convert();
  for (const [jsUrl, newSource] of results) {
    const outPath = path.resolve(outDir, jsUrl);
    const jsDir = path.dirname(outPath);
    // console.log(`writing ${outPath}`);
    mkdirp.sync(jsDir);
    // console.log(`created dir ${jsDir}`);
    await fs.writeFile(outPath, newSource);
  }
}

export class AnalysisConverter {

  analysis: Analysis;

  modules = new Map<string, JsModule>();

  namespacedExports = new Map<string, JsExport>();

  constructor(analysis: Analysis) {
    this.analysis = analysis;
  }

  async convert(): Promise<Map<string, string>> {

    const htmlDocuments = Array.from(this.analysis.getFeatures({kind: 'html-document'}))
      .filter((d) => isNotExternal(d) && isNotTest(d));


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
    // const domModules = document.getFeatures({kind: 'dom-module'});
    // if (domModules.size > 0) {
    //   console.log('domModules', domModules);
    // }

    const jsUrl = htmlUrlToJs(document.url);
    if (this.modules.has(jsUrl)) {
      return;
    }
    new DocumentConverter(this, document).convert();
  }
}

class DocumentConverter {

  jsUrl: string;
  module: JsModule;
  analysisConverter: AnalysisConverter;
  document: Document;
  scriptDocument: Document;
  program: Program;
  currentStatementIndex = 0;  

  constructor(analysisConverter: AnalysisConverter, document: Document) {
    this.analysisConverter = analysisConverter;
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
      this.program = J.program([]);
    } else if (scripts.size > 1) {
      console.log('multiple scripts');
      return;
    } else {
      this.scriptDocument = scripts.values().next().value;
      const jsDoc = this.scriptDocument.parsedDocument as ParsedJavaScriptDocument;
      this.program = jsDoc.ast;
    }
  }

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

    // Replace namespace assignments with exports
    while (this.currentStatementIndex < this.program.body.length) {
      const statement = this.program.body[this.currentStatementIndex] as Statement;
      const exported = getExport(statement, 'Polymer');

      if (exported !== undefined) {
        const {namespace, value} = exported;
        const namespaceName = namespace.join('.');
        
        if (this.isNamespace(statement)) {
          this.rewriteNamespace(namespaceName, value, statement);
        } else if (value.type === 'Identifier') {
          // An 'export' of the form:
          // Polymer.Foo = Foo;
          // TODO: generalize to handle namespaces and other declarations
          const localName = value as Identifier;

          const features = this.document.getFeatures({id: namespaceName});
          const referencedFeature = Array.from(features).find((f) => f.identifiers.has(namespaceName));

          if (referencedFeature && referencedFeature.kinds.has('namespace')) {
            // Polymer.X = X; where X is previously defined as a namespace

            // Find the namespace node and containing statement
            const namespaceFeature = referencedFeature as Namespace;
            const nsParent = namespaceFeature.astNode;
            let nsNode: ObjectExpression;
            if (nsParent.type === 'VariableDeclaration') {
              // case: const n = {...}
              nsNode = nsParent.declarations[0].init as ObjectExpression;
            } else {
              // case: n = {...}
              // assumes an assignment statement!
              nsNode = nsParent.expression.right as ObjectExpression;
            }

            this.rewriteNamespace(namespaceName, nsNode, nsParent);

            // Remove the namespace assignment
            this.program.body.splice(this.currentStatementIndex, 1);
            // Adjust current index since we removed a statement
            this.currentStatementIndex--;
          } else {
            // Not a namespace, fallback to a named export
            // We could probably do better for referenced declarations
            const exportedName = J.identifier(namespace[namespace.length - 1]) as Identifier;
            this.program.body[this.currentStatementIndex] = J.exportNamedDeclaration(
              null, // declaration
              [J.exportSpecifier(localName, exportedName)]);
            this.addExport(namespaceName, exportedName.name);
          }
        } else if (isDeclaration(value)) {
          // TODO (justinfagnani): remove this case? Is it used?
          this.program.body[this.currentStatementIndex] = J.exportDeclaration(
            false, // default
            value);
        } else {
          const name = namespace[namespace.length - 1];

          this.program.body[this.currentStatementIndex] = J.exportNamedDeclaration(
            J.variableDeclaration(
              'let',
              [J.variableDeclarator(J.identifier(name), value)]
            ));
          this.addExport(namespaceName, name);
        }
      }
      this.currentStatementIndex++;
    }

    this.module.source = escodegen.generate(this.program, {
      comment: true,
      format: {
        indent: {
          style: '  ',
          adjustMultilineComment: true,
          base: 0,
        },
      }
    }) + '\n';
  }

  convertDependencies() {
    // DFS to convert dependencies, so we know what exports they have
    const htmlImports = this.document.getFeatures({kind: 'html-import'});
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
              path.replace(J.identifier(getModuleId(jsModule.url)));
            } else {
              path.replace(J.identifier(moduleExport.name));
            }
          }
        }
        this.traverse(path);
      }
    });
  }

  addJsImports() {
    const htmlImports = this.document.getFeatures({kind: 'html-import'});
    const baseUrl = this.document.url;

    // Rewrite HTML Imports to JS imports
    const jsImports = Array.from(htmlImports).map((i) => {
      const jsUrl = htmlUrlToJs(i.url, baseUrl);
      const specifierNames = this.module.importedReferences.get(jsUrl);  
      const specifiers = specifierNames
          ? Array.from(specifierNames).map((s) => {
            if (s === '*') {
              return J.importNamespaceSpecifier(J.identifier(getModuleId(jsUrl)));
            } else {
              return J.importSpecifier(J.identifier(s));
            }
          })
          : [];
      return J.importDeclaration(
        specifiers, // specifiers
        J.literal(jsUrl) // source
      );
    });
    this.program.body.splice(0, 0, ...jsImports);
    this.currentStatementIndex += jsImports.length;
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
  rewriteNamespace(name: string, body: Node, statement: Statement) {
    if (body.type !== 'ObjectExpression') {
      console.warn('unable to handle non-object namespace', this.document.url, body.loc);
      return;
    }

    const exports = getNamespaceExports(body as ObjectExpression);

    // Replace original namespace statement with new exports
    const nsIndex = this.program.body.indexOf(statement);
    this.program.body.splice(nsIndex, 1, ...exports.map((e) => e.node));
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
      if (namespace.astNode === node) {
        return true;
      }
    }
    return false;
  }

}

function getNamespaceExports(namespace: ObjectExpression) {
  const exports = [];

  for (const property of namespace.properties) {
    const {key, value} = property;
    const name = (key as Identifier).name;
    if (value.type === 'ObjectExpression') {
      exports.push({
        name,
        node: J.exportNamedDeclaration(
          J.variableDeclaration(
            'let',
            [J.variableDeclarator(key, value)]))
      });
    } else if (value.type === 'FunctionExpression') {
      const func = value as FunctionExpression;
      exports.push({
        name,
        node: J.exportNamedDeclaration(
          J.functionDeclaration(
            key, //id
            func.params,
            func.body,
            func.generator
          ))
      })
    } else if (value.type === 'ArrowFunctionExpression') {
      exports.push({
        name,
        node: J.exportNamedDeclaration(
          J.variableDeclaration(
            'let',
            [J.variableDeclarator(key, value)]
          ))
      });
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
function getExport(statement: Statement | ModuleDeclaration, rootModuleName: string): {namespace: string[], value: Expression} |undefined {
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

  if (expression.object.type === 'Identifier') {
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

function getModuleId(url: string) {
  const baseName = path.basename(url);
  const lastDotIndex = baseName.lastIndexOf('.');
  const mainName = baseName.substring(0, lastDotIndex);
  return '$' + dashToCamelCase(mainName);
}

function dashToCamelCase(s: string) {
  return s.replace(/-[a-z]/g, (m) => m[1].toUpperCase())
}
