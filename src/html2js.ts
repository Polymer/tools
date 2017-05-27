import * as path from 'path';
import {Analyzer, FSUrlLoader, PackageUrlResolver, Document, ParsedJavaScriptDocument, Namespace} from 'polymer-analyzer';
import * as fs from 'mz/fs';
import { Program, ExpressionStatement, Statement, ModuleDeclaration, Expression, Node, ObjectExpression, FunctionExpression, Identifier} from "@types/estree";

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

/**
 * Converts a Polymer Analyzer HTML document to a JS module
 */
export function html2Js(document: Document): string | undefined {
  // const domModules = document.getFeatures({kind: 'dom-module'});
  // if (domModules.size > 0) {
  //   console.log('domModules', domModules);
  // }

  const scripts = document.getFeatures({kind: 'js-document'});
  if (scripts.size === 0) {
    console.log('no scripts');
  } else if (scripts.size > 1) {
    console.log('multiple scripts');
  } else {
    const scriptDocument = scripts.values().next().value;
    const jsDoc = scriptDocument.parsedDocument as ParsedJavaScriptDocument;
    const program = jsDoc.ast;

    // Unwrap module-IIFE
    program.body = getModuleBody(program);

    // Rewrite HTML Imports to JS imports
    const htmlImports = document.getFeatures({kind: 'html-import'});
    const jsImports = Array.from(htmlImports).map((i) => J.importDeclaration(
      [], // specifiers
      J.literal(htmlUrlToJs(i.url)) // source
    ));
    program.body.splice(0, 0, ...jsImports);

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

    return scriptDocument.stringify();
  }
  return undefined;
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
function htmlUrlToJs(url: string): string {
  const htmlExtension = '.html';
  let base = url;
  if (url.endsWith(htmlExtension)) {
    base = url.substring(0, url.length - htmlExtension.length);
  }

  // We've lost the actual URL string and thus the leading ./
  // This should be fixed in the Analyzer, and this hack isn't even right
  if (!url.startsWith('.') && !url.startsWith('/')) {
    base = './' + base;
  }
  return base + '.js';
}
