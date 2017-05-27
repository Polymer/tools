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
import {Analyzer, FSUrlLoader, PackageUrlResolver, Document, ParsedJavaScriptDocument, Namespace} from 'polymer-analyzer';
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

/**
 * Converts an entire package from HTML imports to JS modules
 */
export async function convertPackage() {
  const analysis = await analyzer.analyzePackage();
  const outDir = path.resolve(process.cwd(), 'js_out');
  console.log(`Out directory: ${outDir}`);

  try {
    await fs.mkdir(outDir);
  } catch (e) {
    console.error(e);
  }

  const htmlDocuments = Array.from(analysis.getFeatures({kind: 'html-document'}))
    .filter((d) => isNotExternal(d) && isNotTest(d));

  // console.log(htmlDocuments.map((d) => d.url));

  for (const document of htmlDocuments) {
    try {
      const newSource = html2Js(document);
      if (newSource) {
        const jsUrl = htmlUrlToJs(document.url);
        const outPath = path.resolve(outDir, jsUrl);
        const jsDir = path.dirname(outPath);
        console.log(`writing ${outPath}`);
        mkdirp.sync(jsDir);
        console.log(`created dir ${jsDir}`);
        await fs.writeFile(outPath, newSource);
      }
    } catch (e) {
      console.error(`Error in ${document.url}`, e);
    }
  }
}

export interface ModuleExport {
  url: string;
  name: string;
}

/**
 * Converts a Polymer Analyzer HTML document to a JS module
 */
export function html2Js(document: Document, exports?: Map<string, ModuleExport>): string | undefined {
  // const domModules = document.getFeatures({kind: 'dom-module'});
  // if (domModules.size > 0) {
  //   console.log('domModules', domModules);
  // }

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
  if (exports !== undefined) {

    astTypes.visit(program, {
      visitMemberExpression(path: any) {
        const memberPath = getMemberPath(path.node);
        if (memberPath) {
          const memberName = memberPath.join('.');
          const moduleExport = exports.get(memberName);
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
            path.replace(J.identifier(moduleExport.name));
          }
        }
        this.traverse(path);
      }
    });

  }

  // Rewrite HTML Imports to JS imports
  const htmlImports = document.getFeatures({kind: 'html-import'});
  const jsImports = Array.from(htmlImports).map((i) => {
    const jsUrl = htmlUrlToJs(i.url, document.url);
    const specifierNames = importedReferences.get(jsUrl);  
    const specifiers = specifierNames
        ? Array.from(specifierNames).map((s) => J.importSpecifier(J.identifier(s)))
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
          const exports = getNamespaceExports(value as ObjectExpression);
          program.body.splice(i, 1, ...exports);
          i += exports.length - 1;
        } else if (value.type === 'Identifier') {
          // An 'export' of the form:
          // Polymer.Foo = Foo;
          const localName = value as Identifier;

          const features = document.getFeatures({id: localName.name});
          const referencedFeature = Array.from(features).find((f) => f.identifiers.has(localName.name));

          if (referencedFeature && referencedFeature.kinds.has('namespace')) {
            const namespace = referencedFeature as Namespace;

            // Remove namespace node
            const nsIndex = program.body.findIndex((statement) => namespace.astNode === statement);
            program.body.splice(nsIndex, 1);
            if (nsIndex < i) {
              i--;
            }

            // Replace the export
            // assumes an assignment statement!
            const nsNode = namespace.astNode.expression.right as ObjectExpression
            const exports = getNamespaceExports(nsNode);
            program.body.splice(i, 1, ...exports);
            i += exports.length - 1;
          } else {
            // fallback
            const exportedName = J.identifier(namespace[namespace.length - 1]);
            program.body[i] = J.exportNamedDeclaration(
              null, // declaration
              [J.exportSpecifier(localName, exportedName)] // specifiers
              //source
            );
          }
        } else if (isDeclaration(value)) {
          program.body[i] = J.exportDeclaration(
            false, // default
            value, // declaration
            // specifiers
            //source
          );
        } else {
          const name = namespace[namespace.length - 1];

          program.body[i] = J.exportNamedDeclaration(
            J.variableDeclaration(
              'let',
              [J.variableDeclarator(J.identifier(name), value)]
            ), // declaration
            // specifiers
            //source
          );
        }
      }
    }
  }


  return escodegen.generate(program, {
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
    if (value.type === 'ObjectExpression') {
      exports.push(J.exportNamedDeclaration(
        J.variableDeclaration(
          'let',
          [J.variableDeclarator(key, value)]
        ), // declaration
        // specifiers
        //source
      ));
    } else if (value.type === 'FunctionExpression') {
      const func = value as FunctionExpression;
      exports.push(J.exportNamedDeclaration(
        J.functionDeclaration(
          key, //id
          func.params,
          func.body,
          func.generator
        ) // declaration
        // specifiers
        //source
      ))
    } else if (value.type === 'ArrowFunctionExpression') {
      exports.push(J.exportNamedDeclaration(
        J.variableDeclaration(
          'let',
          [J.variableDeclarator(key, value)]
        ), // declaration
        // specifiers
        //source
      ));
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

