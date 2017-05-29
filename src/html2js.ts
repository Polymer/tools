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
import {Analyzer, FSUrlLoader, PackageUrlResolver, Document, ParsedJavaScriptDocument, Namespace, Analysis} from 'polymer-analyzer';
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
  url: string;
  name: string;
}

export interface JsModule {
  url: string;
  source: string;
  exports: Set<string>;
}

export interface ExportIndex {
  /**
   * Map of module URL to exported names
   */
  modules: Map<string, JsModule>;

  /**
   * Map of namespaced name to module URL + exported name
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
  const results = await convert(analysis);
  for (const [jsUrl, newSource] of results) {
    const outPath = path.resolve(outDir, jsUrl);
    const jsDir = path.dirname(outPath);
    // console.log(`writing ${outPath}`);
    mkdirp.sync(jsDir);
    // console.log(`created dir ${jsDir}`);
    await fs.writeFile(outPath, newSource);
  }
}

export async function convert(analysis: Analysis): Promise<Map<string, string>> {

  const htmlDocuments = Array.from(analysis.getFeatures({kind: 'html-document'}))
    .filter((d) => isNotExternal(d) && isNotTest(d));

  const exportIndex: ExportIndex = {
    modules: new Map<string, JsModule>(),
    namespacedExports: new Map<string, JsExport>(),
  };

  const results = new Map<string, string>()

  for (const document of htmlDocuments) {
    try {
      html2Js(document, exportIndex);
      const jsUrl = htmlUrlToJs(document.url);
      const module = exportIndex.modules.get(jsUrl);
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
export function html2Js(document: Document, exportIndex: ExportIndex): void {
  // const domModules = document.getFeatures({kind: 'dom-module'});
  // if (domModules.size > 0) {
  //   console.log('domModules', domModules);
  // }

  const jsUrl = htmlUrlToJs(document.url);
  if (exportIndex.modules.has(jsUrl)) {
    return;
    // throw new Error(`Already processed ${document.url}`);
  }
  const module: JsModule = {
    url: jsUrl,
    source: '',
    exports: new Set<string>(),
  };
  exportIndex.modules.set(jsUrl, module);
  // DFS to convert dependencies, so we know what exports they have
  const htmlImports = document.getFeatures({kind: 'html-import'});
  for (const htmlImport of htmlImports) {
    const jsUrl = htmlUrlToJs(htmlImport.url, document.url);
    if (exportIndex.modules.has(jsUrl)) {
      continue;
    }
    html2Js(htmlImport.document, exportIndex);
  }

  const scripts = document.getFeatures({kind: 'js-document'});

  let scriptDocument: Document|undefined = undefined;
  let program: Program;

  if (scripts.size === 0) {
    program = J.program([]);
  } else if (scripts.size > 1) {
    console.log('multiple scripts');
    return;
  } else {
    scriptDocument = scripts.values().next().value;
    const jsDoc = scriptDocument.parsedDocument as ParsedJavaScriptDocument;
    program = jsDoc.ast;
  }

  // Unwrap module-IIFE
  program.body = getModuleBody(program);

  // module path -> imported names
  const importedReferences = new Map<string, Set<string>>();

  // Rewrite all references to imports
  astTypes.visit(program, {
    visitMemberExpression(path: any) {
      const memberPath = getMemberPath(path.node);
      if (memberPath) {
        const memberName = memberPath.join('.');
        const moduleExport = exportIndex.namespacedExports.get(memberName);
        if (moduleExport) {
          // Store the imported reference to we can add it to the import statement
          const moduleJsUrl = htmlUrlToJs(moduleExport.url, document.url);
          let moduleImportedNames = importedReferences.get(moduleJsUrl);
          if (moduleImportedNames === undefined) {
            moduleImportedNames = new Set<string>();
            importedReferences.set(moduleJsUrl, moduleImportedNames);
          }
          moduleImportedNames.add(moduleExport.name);

          // replace the member expression
          if (moduleExport.name === '*') {
            const jsModule = exportIndex.modules.get(moduleExport.url)!;
            path.replace(J.identifier(getModuleId(jsModule.url)));
          } else {
            path.replace(J.identifier(moduleExport.name));
          }
        }
      }
      this.traverse(path);
    }
  });

  // Rewrite HTML Imports to JS imports
  const jsImports = Array.from(htmlImports).map((i) => {
    const jsUrl = htmlUrlToJs(i.url, document.url);
    const specifierNames = importedReferences.get(jsUrl);  
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
  program.body.splice(0, 0, ...jsImports);

  if (scriptDocument !== undefined) {
    // Replace namespace assignments with exports
    for (let i = jsImports.length; i < program.body.length; i++) {
      const statement = program.body[i];
      const exported = getExport(statement, 'Polymer');

      if (exported !== undefined) {
        const {namespace, value} = exported;
        if (isNamespace(statement, scriptDocument)) {
          const namespaceName = namespace.join('.');
          // TODO: combine with namespace handling below?
          if (value.type !== 'ObjectExpression') {
            console.warn('unable to handle non-object namespace', document.url, value.loc);
            continue;
          }
          const exports = getNamespaceExports(value as ObjectExpression);
          program.body.splice(i, 1, ...exports.map((e) => e.node));
          i += exports.length - 1;
          exports.forEach((e) => {
            module.exports.add(e.name);
            const fullName = [...namespace, e.name].join('.');
            exportIndex.namespacedExports.set(fullName, {
              url: jsUrl,
              name: e.name,
            });
          });
          exportIndex.namespacedExports.set(namespaceName, {
            url: jsUrl,
            name: '*',
          });
        } else if (value.type === 'Identifier') {
          // An 'export' of the form:
          // Polymer.Foo = Foo;
          const localName = value as Identifier;
          const namespaceName = namespace.join('.');

          const features = document.getFeatures({id: namespaceName});
          const referencedFeature = Array.from(features).find((f) => f.identifiers.has(namespaceName));

          if (referencedFeature && referencedFeature.kinds.has('namespace')) {
            // Polymer.X = X; where X is previously defined as a namespace
            const namespaceFeature = referencedFeature as Namespace;

            // Remove namespace node
            const nsIndex = program.body.findIndex((statement) => namespaceFeature.astNode === statement);
            program.body.splice(nsIndex, 1);
            if (nsIndex < i) {
              i--;
            }

            // Replace the export
            const nsParent = namespaceFeature.astNode;
            let nsNode: ObjectExpression;
            if (nsParent.type === 'VariableDeclaration') {
              nsNode = nsParent.declarations[0].init as ObjectExpression;
            } else {
              // assumes an assignment statement!
              nsNode = nsParent.expression.right as ObjectExpression;
            }
            const exports = getNamespaceExports(nsNode);
            program.body.splice(i, 1, ...exports.map((e) => e.node));
            i += exports.length - 1;
            exports.forEach((e) => {
              module.exports.add(e.name);
              const fullName = [...namespace, e.name].join('.');
              exportIndex.namespacedExports.set(fullName, {
                url: jsUrl,
                name: e.name,
              });
            });
            exportIndex.namespacedExports.set(namespaceName, {
              url: jsUrl,
              name: '*',
            });
          } else {
            // fallback, named export
            // We could probably do better for referenced classes, functions, etc
            const exportedName = J.identifier(namespace[namespace.length - 1]) as Identifier;
            program.body[i] = J.exportNamedDeclaration(
              null, // declaration
              [J.exportSpecifier(localName, exportedName)]);
            exportIndex.namespacedExports.set(namespace.join('.'), {
              url: jsUrl,
              name: exportedName.name,
            });
          }
        } else if (isDeclaration(value)) {
          // TODO (justinfagnani): remove this case? Is it used?
          program.body[i] = J.exportDeclaration(
            false, // default
            value);
        } else {
          const name = namespace[namespace.length - 1];

          program.body[i] = J.exportNamedDeclaration(
            J.variableDeclaration(
              'let',
              [J.variableDeclarator(J.identifier(name), value)]
            ));
          module.exports.add(name);
          exportIndex.namespacedExports.set(namespace.join('.'), {
            url: jsUrl,
            name,
          });
        }
      }
    }
  }

  module.source = escodegen.generate(program, {
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

/**
 * Returns the implied module body of a script - if there's a top-level IIFE, it
 * assumes that is an intentionally scoped ES5 module body.
 */
function getModuleBody(program: Program): (Statement | ModuleDeclaration)[] {
  if (program.body.length === 1 &&
      program.body[0].type === 'ExpressionStatement') {
    const expression = (program.body[0] as ExpressionStatement).expression;
    if (expression.type === 'CallExpression') {
      const callee = expression.callee;
      if (callee.type === 'FunctionExpression') {
        const body = callee.body.body;
        if (body.length > 1 && isUseStrict(body[0])) {
          return body.slice(1);
        }
        return body;
      }
    }
  }
  return program.body;
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

function isNamespace(node: Node, document: Document) {
  const namespaces = document.getFeatures({kind: 'namespace'});
  for (const namespace of namespaces) {
    if (namespace.astNode === node) {
      return true;
    }
  }
  return false;
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
