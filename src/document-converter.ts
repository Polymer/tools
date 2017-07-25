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
import * as estree from 'estree';
import {BlockStatement, Expression, Identifier, ImportDeclaration, MemberExpression, ModuleDeclaration, Node, ObjectExpression, Program, Statement} from 'estree';
import * as parse5 from 'parse5';
import * as path from 'path';
import {Document, Import, Severity, Warning} from 'polymer-analyzer';
import * as recast from 'recast';

import {AnalysisConverter} from './analysis-converter';
import {JsExport, JsModule, NamespaceMemberToExport} from './js-module';
import {htmlUrlToJs} from './url-converter';
import {getImportAlias, getModuleId, nodeToTemplateLiteral, serializeNode, sourceLocationsEqual} from './util';


import jsc = require('jscodeshift');


const astTypes = require('ast-types');
interface AstPath<N extends Node = Node> {
  node: N;
  parent?: {node: Node};
  replace(replacement: Node): void;
}

/**
 * Convert a module specifier & an optional set of named exports (or '*' to
 * import entire namespace) to a set of ImportDeclaration objects.
 */
function getImportDeclarations(
    specifierUrl: string, namedExports?: Iterable<string>) {
  const jsImportDeclarations: ImportDeclaration[] = [];
  const namedExportsArray = namedExports ? Array.from(namedExports) : [];
  const hasNamespaceReference = namedExportsArray.some((s) => s === '*');
  const namedSpecifiers =
      namedExportsArray.filter((s) => s !== '*')
          .map(
              (s) => jsc.importSpecifier(
                  jsc.identifier(s), jsc.identifier(getImportAlias(s))));
  // If a module namespace was referenced, create a new namespace import
  if (hasNamespaceReference) {
    jsImportDeclarations.push(jsc.importDeclaration(
        [jsc.importNamespaceSpecifier(
            jsc.identifier(getModuleId(specifierUrl)))],
        jsc.literal(specifierUrl)));
  }
  // If any named imports were referenced, create a new import for all named
  // members. If `namedSpecifiers` is empty but a namespace wasn't imported
  // either, then still add an empty importDeclaration to trigger the load.
  if (namedSpecifiers.length > 0 || !hasNamespaceReference) {
    jsImportDeclarations.push(
        jsc.importDeclaration(namedSpecifiers, jsc.literal(specifierUrl)));
  }
  return jsImportDeclarations;
}


const elementBlacklist = new Set<string|undefined>([
  'base',
  'link',
  'meta',
  'script',
  'dom-module',
]);


/**
 * Converts a Document and its dependencies.
 */
export class DocumentConverter {
  private readonly jsUrl: string;
  private readonly analysisConverter: AnalysisConverter;
  private readonly document: Document;
  private program: Program;
  private readonly _mutableExports:
      {readonly [namespaceName: string]: ReadonlyArray<string>};

  constructor(analysisConverter: AnalysisConverter, document: Document) {
    this.analysisConverter = analysisConverter;
    this._mutableExports =
        Object.assign({}, this.analysisConverter._mutableExports!);
    this.document = document;
    this.jsUrl = htmlUrlToJs(document.url);
  }

  /**
   * Returns the HTML Imports of a document, except imports to documents
   * specifically excluded in the AnalysisConverter.
   *
   * Note: Imports that are not found are not returned by the analyzer.
   */
  private getHtmlImports() {
    return Array.from(this.document.getFeatures({kind: 'html-import'}))
        .filter((f: Import) => !this.analysisConverter._excludes.has(f.url));
  }

  convertToJsModule(): Iterable<JsModule> {
    const toplevelStatements = [];
    for (const script of this.document.getFeatures({kind: 'js-document'})) {
      const file = recast.parse(script.parsedDocument.contents);
      toplevelStatements.push(...file.program.body);
    }
    this.program = jsc.program(toplevelStatements);
    this.convertDependencies();
    this.unwrapIIFEPeusdoModule();
    const importedReferences = this.rewriteNamespacedReferences();
    this.addJsImports(importedReferences);
    this.insertCodeToGenerateHtmlElements();
    this.inlineTemplates();

    const {localNamespaceName, namespaceName, exportMigrationRecords} =
        this.rewriteNamespaceExports();

    this.rewriteNamespaceThisReferences(namespaceName);
    this.rewriteReferencesToTheLocallyDefinedNamespace(localNamespaceName);
    this.rewriteReferencesToTheLocallyDefinedNamespace(namespaceName);
    this.rewriteExcludedReferences();
    this.warnOnDangerousReferences();

    const outputProgram = recast.print(
        this.program, {quote: 'single', wrapColumn: 80, tabWidth: 2});
    return [{
      url: this.jsUrl,
      source: outputProgram.code + '\n',
      exportedNamespaceMembers: exportMigrationRecords,
      es6Exports: new Set(exportMigrationRecords.map((r) => r.es6ExportName))
    }];
  }

  convertAsToplevelHtmlDocument(): Iterable<JsModule> {
    this.convertDependencies();

    interface Edit {
      offsets: [number, number];
      replacementText: string;
    }
    const edits: Array<Edit> = [];
    for (const script of this.document.getFeatures({kind: 'js-document'})) {
      const astNode = script.astNode;
      if (!astNode || !isLegacyJavascriptTag(astNode)) {
        continue;  // ignore unknown script tags and preexisting modules
      }
      const sourceRange = script.astNode ?
          this.document.parsedDocument.sourceRangeForNode(script.astNode) :
          undefined;
      if (!sourceRange) {
        continue;  // nothing we can do about scripts without known positions
      }
      const offsets =
          this.document.parsedDocument.sourceRangeToOffsets(sourceRange);

      const file = recast.parse(script.parsedDocument.contents);
      this.program = file.program;

      if (this.writesToGlobalSettingsObjects()) {
        continue;
      }

      this.unwrapIIFEPeusdoModule();
      const importedReferences = this.rewriteNamespacedReferences();
      const wereImportsAdded = this.addJsImports(importedReferences);
      // Don't convert the HTML.
      // Don't inline templates, they're fine where they are.
      // Don't rewrite exports, we can't export anything.

      this.rewriteExcludedReferences();
      this.warnOnDangerousReferences();

      if (!wereImportsAdded) {
        continue;  // no imports, no reason to convert to a module
      }

      const newScriptTag =
          parse5.treeAdapters.default.createElement('script', '', []);
      dom5.setAttribute(newScriptTag, 'type', 'module');
      dom5.setTextContent(
          newScriptTag,
          '\n' +
              recast
                  .print(
                      this.program,
                      {quote: 'single', wrapColumn: 80, tabWidth: 2})
                  .code +
              '\n');
      const replacementText = serializeNode(newScriptTag);
      edits.push({offsets, replacementText});
    }

    for (const htmlImport of this.document.getFeatures({kind: 'html-import'})) {
      // Only replace imports that are actually in the document.
      if (!htmlImport.sourceRange) {
        continue;
      }
      const offsets = this.document.parsedDocument.sourceRangeToOffsets(
          htmlImport.sourceRange);

      const packageRelativeUrl = htmlUrlToJs(htmlImport.url);
      let fileRelativeUrl =
          path.relative(path.dirname(this.document.url), packageRelativeUrl);
      if (!fileRelativeUrl.startsWith('../')) {
        fileRelativeUrl = `./${fileRelativeUrl}`;
      }
      const scriptTag = parse5.parseFragment(`<script type="module"></script>`)
                            .childNodes![0];
      dom5.setAttribute(scriptTag, 'src', fileRelativeUrl);
      const replacementText = serializeNode(scriptTag);
      edits.push({offsets, replacementText});
    }

    // Apply edits from bottom to top, so that the offsets stay valid.
    edits.sort(({offsets: [startA]}, {offsets: [startB]}) => startB - startA);
    let contents = this.document.parsedDocument.contents;
    for (const {offsets: [start, end], replacementText} of edits) {
      contents =
          contents.slice(0, start) + replacementText + contents.slice(end);
    }
    return [{
      url: './' + this.document.url,
      source: contents,
      exportedNamespaceMembers: [],
      es6Exports: new Set()
    }];
  }

  private writesToGlobalSettingsObjects() {
    let containsWriteToGlobalSettingsObject = false;
    const globalSettingsObjects =
        new Set<string>(['Polymer', 'Polymer.Settings', 'ShadyDOM']);

    function getNamespacedName(node: Node) {
      if (node.type === 'Identifier') {
        return node.name;
      }
      const memberPath = getMemberPath(node);
      if (memberPath) {
        return memberPath.join('.');
      }
      return undefined;
    }
    astTypes.visit(this.program, {
      visitAssignmentExpression(path: AstPath<estree.AssignmentExpression>) {
        const name = getNamespacedName(path.node.left);
        if (globalSettingsObjects.has(name!)) {
          containsWriteToGlobalSettingsObject = true;
        }
        return false;
      },
    });

    return containsWriteToGlobalSettingsObject;
  }

  /**
   * Recreate the HTML contents from the original HTML document by adding
   * code to the top of this.program that constructs equivalent DOM and insert
   * it into `window.document`.
   */
  private insertCodeToGenerateHtmlElements() {
    const ast = this.document.parsedDocument.ast as parse5.ASTNode;
    if (ast.childNodes === undefined) {
      return;
    }
    const htmlElement = ast.childNodes!.find((n) => n.tagName === 'html');
    const head = htmlElement!.childNodes!.find((n) => n.tagName === 'head')!;
    const body = htmlElement!.childNodes!.find((n) => n.tagName === 'body')!;
    const elements = [
      ...head.childNodes!.filter(
          (n: parse5.ASTNode) => n.tagName !== undefined),
      ...body.childNodes!.filter((n: parse5.ASTNode) => n.tagName !== undefined)
    ];

    const genericElements =
        elements.filter((e) => !elementBlacklist.has(e.tagName));
    if (genericElements.length === 0) {
      return;
    }
    const varName = `$_documentContainer`;
    const fragment = {
      nodeName: '#document-fragment',
      attrs: [],
      childNodes: genericElements,
    };
    const templateValue = nodeToTemplateLiteral(fragment as any, false);

    const statements = [
      jsc.variableDeclaration(
          'const', [jsc.variableDeclarator(
                       jsc.identifier(varName),
                       jsc.callExpression(
                           jsc.memberExpression(
                               jsc.identifier('document'),
                               jsc.identifier('createElement')),
                           [jsc.literal('div')]))]),
      jsc.expressionStatement(jsc.callExpression(
          jsc.memberExpression(
              jsc.identifier(varName), jsc.identifier('setAttribute')),
          [jsc.literal('style'), jsc.literal('display: none;')])),
      jsc.expressionStatement(jsc.assignmentExpression(
          '=',
          jsc.memberExpression(
              jsc.identifier(varName), jsc.identifier('innerHTML')),
          templateValue)),
      jsc.expressionStatement(jsc.callExpression(
          jsc.memberExpression(
              jsc.memberExpression(
                  jsc.identifier('document'), jsc.identifier('head')),
              jsc.identifier('appendChild')),
          [jsc.identifier(varName)]))
    ];
    let insertionPoint = 0;
    for (const [idx, statement] of enumerate(this.program.body)) {
      if (statement.type === 'ImportDeclaration') {
        continue;
      }
      // First stement past the imports.
      insertionPoint = idx;
      break;
    }
    this.program.body.splice(insertionPoint, 0, ...statements);
  }

  /**
   * Find places in this.program that look like they're exporting symbols by
   * writing them onto namespaces. Transform these into ES6 module exports.
   */
  private rewriteNamespaceExports() {
    const exportMigrationRecords: NamespaceMemberToExport[] = [];
    let currentStatementIndex = 0;
    let localNamespaceName: string|undefined;
    let namespaceName: string|undefined;

    const rewriteNamespaceObject =
        (name: string,
         body: ObjectExpression,
         statement: Statement | ModuleDeclaration) => {
          const mutableExports = this._mutableExports[name];
          const namespaceExports = getNamespaceExports(body, mutableExports);

          // Replace original namespace statement with new exports
          const nsIndex = this.program.body.indexOf(statement);
          this.program.body.splice(
              nsIndex, 1, ...namespaceExports.map((e) => e.node));
          currentStatementIndex += namespaceExports.length - 1;
          for (const e of namespaceExports) {
            exportMigrationRecords.push({
              oldNamespacedName: `${name}.${e.name}`,
              es6ExportName: e.name
            });
          }
          exportMigrationRecords.push(
              {oldNamespacedName: name, es6ExportName: '*'});
        };

    // Walk through all top-level statements and replace namespace assignments
    // with module exports.
    while (currentStatementIndex < this.program.body.length) {
      const statement = this.program.body[currentStatementIndex];
      const exported = getExport(statement, this.analysisConverter.namespaces);

      if (exported !== undefined) {
        const {namespace, value} = exported;
        namespaceName = namespace.join('.');

        if (this.isNamespace(statement) && value.type === 'ObjectExpression') {
          rewriteNamespaceObject(namespaceName, value, statement);
          localNamespaceName = namespaceName;
        } else if (value.type === 'Identifier') {
          // An 'export' of the form:
          // Polymer.Foo = Foo;
          // TODO(justinfagnani): generalize to handle namespaces and other
          // declarations
          const localName = value;

          const features = this.document.getFeatures({id: namespaceName});
          // TODO(fks) 06-06-2017: '!' required below due to Typscript bug,
          // remove when fixed
          const referencedFeature = Array.from(features).find(
              (f) => f.identifiers.has(namespaceName!));

          if (referencedFeature && referencedFeature.kinds.has('namespace')) {
            // Polymer.X = X; where X is previously defined as a namespace

            // Find the namespace node and containing statement
            const namespaceFeature = referencedFeature;
            const nsParent = this.getNode(namespaceFeature.astNode);
            if (nsParent == null) {
              throw new Error(`can't find associated node for namespace`);
            }
            let nsNode: ObjectExpression;
            if (nsParent.type === 'VariableDeclaration' &&
                nsParent.declarations.length > 0) {
              // case: const n = {...}
              const declaration = nsParent.declarations[0]!;
              if (declaration.init &&
                  declaration.init.type === 'ObjectExpression') {
                nsNode = declaration.init;
              } else {
                // we only know how to handle object literals here,
                // bail on the other cases.
                continue;
              }
            } else if (
                nsParent.type === 'ExpressionStatement' &&
                nsParent.expression.type === 'AssignmentExpression') {
              // case: n = {...}
              const expression = nsParent.expression;
              if (expression.right.type === 'ObjectExpression') {
                nsNode = expression.right;
              } else {
                // we only know how to handle object literals here,
                // bail on the other cases.
                continue;
              }
            } else {
              // Not a known kind of namespace declaration.
              continue;
            }
            rewriteNamespaceObject(namespaceName, nsNode, nsParent);

            // Remove the namespace assignment
            this.program.body.splice(currentStatementIndex, 1);
            // Adjust current index since we removed a statement
            currentStatementIndex--;
          } else {
            // Not a namespace, fallback to a named export
            // We could probably do better for referenced declarations, ie move
            // the export to the declaration
            const exportedName =
                jsc.identifier(namespace[namespace.length - 1]);
            this.program.body[currentStatementIndex] =
                jsc.exportNamedDeclaration(
                    null,  // declaration
                    [jsc.exportSpecifier(localName, exportedName)]);
            exportMigrationRecords.push({
              es6ExportName: exportedName.name,
              oldNamespacedName: namespaceName
            });
          }
        } else if (isDeclaration(value)) {
          // TODO (justinfagnani): remove this case? Is it used? Add a test
          this.program.body[currentStatementIndex] = jsc.exportDeclaration(
              false,  // default
              value);
        } else {
          let name = namespace[namespace.length - 1];
          // Special Polymer workaround: Register & rewrite the
          // `Polymer._polymerFn` export as if it were the `Polymer()`
          // namespace function.
          if (namespaceName === 'Polymer._polymerFn') {
            namespaceName = 'Polymer';
            name = 'Polymer';
          }
          this.program.body[currentStatementIndex] =
              jsc.exportNamedDeclaration(jsc.variableDeclaration(
                  'const',
                  [jsc.variableDeclarator(jsc.identifier(name), value)]));
          exportMigrationRecords.push(
              {oldNamespacedName: namespaceName, es6ExportName: name});
        }
      } else if (
          this.isNamespace(statement) &&
          statement.type === 'VariableDeclaration') {
        // Local namespace declaration, like:
        // /** @namespace */ const Foo = {};
        // Set the localNamespacename so we can rewrite internal references
        const declarator = statement.declarations[0];
        if (declarator.id.type === 'Identifier') {
          localNamespaceName = declarator.id.name;
        }
      } else if (localNamespaceName) {
        const namespaceAssignment =
            getExport(statement, new Set([localNamespaceName]));

        if (namespaceAssignment !== undefined) {
          const {namespace, value} = namespaceAssignment;
          const name = namespace[namespace.length - 1];
          namespaceName = namespace.join('.');

          this.program.body[currentStatementIndex] =
              jsc.exportNamedDeclaration(jsc.variableDeclaration(
                  'const',
                  [jsc.variableDeclarator(jsc.identifier(name), value)]));
          exportMigrationRecords.push(
              {oldNamespacedName: namespaceName, es6ExportName: name});
        }
      }
      currentStatementIndex++;
    }

    return {
      localNamespaceName,
      namespaceName,
      exportMigrationRecords,
    };
  }

  /**
   * Find Polymer element templates in the original HTML. Insert these templates
   * as strings as part of the javascript element declaration.
   */
  private inlineTemplates() {
    const elements = this.document.getFeatures({'kind': 'polymer-element'});
    for (const element of elements) {
      const domModule = element.domModule;
      if (domModule === undefined) {
        continue;
      }
      const template = dom5.query(domModule, (e) => e.tagName === 'template');
      if (template === null) {
        continue;
      }

      const templateLiteral = nodeToTemplateLiteral(
          parse5.treeAdapters.default.getTemplateContent(template));
      const node = this.getNode(element.astNode);

      if (node === undefined) {
        console.warn(
            new Warning({
              code: 'not-found',
              message: `Can't find recat node for element ${element.tagName}`,
              parsedDocument: this.document.parsedDocument,
              severity: Severity.WARNING,
              sourceRange: element.sourceRange!
            }).toString());
        continue;
      }

      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        // A Polymer 2.0 class-based element
        node.body.body.splice(
            0,
            0,
            jsc.methodDefinition(
                'get',
                jsc.identifier('template'),
                jsc.functionExpression(
                    null, [], jsc.blockStatement([jsc.returnStatement(
                                  templateLiteral)]))));
      } else if (node.type === 'CallExpression') {
        // A Polymer hybrid/legacy factory function element
        const arg = node.arguments[0];
        if (arg && arg.type === 'ObjectExpression') {
          arg.properties.unshift(jsc.property(
              'init', jsc.identifier('_template'), templateLiteral));
        }
      }
    }
  }

  /**
   * Convert dependencies first, so we know what exports they have.
   *
   * Mutates this.analysisConverter to register their exports.
   */
  private convertDependencies() {
    for (const htmlImport of this.getHtmlImports()) {
      const jsUrl = htmlUrlToJs(htmlImport.url, this.document.url);
      if (this.analysisConverter.modules.has(jsUrl)) {
        continue;
      }
      this.analysisConverter.convertDocument(htmlImport.document);
    }
  }

  /**
   * Rewrite namespaced references to the imported name. e.g. changes
   * Polymer.Element -> $Element
   *
   * Also mutates this.module.importedReferences to include the imported urls
   * and names so that the proper imports can be added in a later pass.
   */
  private rewriteNamespacedReferences() {
    const analysisConverter = this.analysisConverter;
    const importedReferences = new Map<string, Set<string>>();

    /**
     * Add the given JsExport to this.module's `importedReferences` map.
     */
    const addToImportedReferences = (moduleExport: JsExport) => {
      const moduleJsUrl = htmlUrlToJs(moduleExport.url, this.document.url);
      let moduleImportedNames = importedReferences.get(moduleJsUrl);
      if (moduleImportedNames === undefined) {
        moduleImportedNames = new Set<string>();
        importedReferences.set(moduleJsUrl, moduleImportedNames);
      }
      moduleImportedNames.add(moduleExport.name);
    };

    astTypes.visit(this.program, {
      visitIdentifier(path: AstPath<Identifier>) {
        const memberName = path.node.name;
        const isNamespace = analysisConverter.namespaces.has(memberName);
        const parentIsMemberExpression =
            (path.parent && getMemberPath(path.parent.node)) !== undefined;
        if (!isNamespace || parentIsMemberExpression) {
          return false;
        }
        const exportOfMember =
            analysisConverter.namespacedExports.get(memberName);
        if (!exportOfMember) {
          return false;
        }
        // Store the imported reference & rewrite the Identifier
        addToImportedReferences(exportOfMember);
        path.replace(exportOfMember.expressionToAccess());
        return false;
      },
      visitMemberExpression(path: AstPath<MemberExpression>) {
        const memberPath = getMemberPath(path.node);
        if (!memberPath) {
          this.traverse(path);
          return;
        }
        const memberName = memberPath.join('.');
        const exportOfMember =
            analysisConverter.namespacedExports.get(memberName);
        if (!exportOfMember) {
          this.traverse(path);
          return;
        }
        // Store the imported reference & rewrite the MemberExpression
        addToImportedReferences(exportOfMember);
        path.replace(exportOfMember.expressionToAccess());
        return false;
      }
    });
    return importedReferences;
  }

  /**
   * Rewrite references in _referenceExcludes and well known properties that
   * don't work well in modular code.
   */
  private rewriteExcludedReferences() {
    const mapOfRewrites = new Map(this.analysisConverter._referenceRewrites);
    for (const reference of this.analysisConverter._referenceExcludes) {
      mapOfRewrites.set(reference, jsc.identifier('undefined'));
    }

    astTypes.visit(this.program, {
      visitMemberExpression(path: AstPath<MemberExpression>) {
        const memberPath = getMemberPath(path.node);
        if (memberPath !== undefined) {
          const memberName = memberPath.join('.');
          const replacement = mapOfRewrites.get(memberName);
          if (replacement) {
            path.replace(replacement);
          }
        }
        this.traverse(path);
      }
    });
  }

  private warnOnDangerousReferences() {
    const dangerousReferences = this.analysisConverter.dangerousReferences;
    astTypes.visit(this.program, {
      visitMemberExpression(path: AstPath<MemberExpression>) {
        const memberPath = getMemberPath(path.node);
        if (memberPath !== undefined) {
          const memberName = memberPath.join('.');
          const warningMessage = dangerousReferences.get(memberName);
          if (warningMessage) {
            // TODO(rictic): track the relationship between the programs and
            // documents so we can display real Warnings here.
            console.warn(`Issue in ${this.document.url}: ${warningMessage}`);
            // console.warn(new Warning({
            //                code: 'dangerous-ref',
            //                message: warningMessage,
            //                parsedDocument???,
            //                severity: Severity.WARNING,
            //                sourceRange???
            //              }).toString());
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
  private rewriteReferencesToTheLocallyDefinedNamespace(  //
      namespaceName?: string) {
    if (namespaceName === undefined) {
      return;
    }
    astTypes.visit(this.program, {
      visitMemberExpression(path: AstPath<MemberExpression>) {
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
  private rewriteNamespaceThisReferences(namespaceName?: string) {
    if (namespaceName === undefined) {
      return;
    }
    astTypes.visit(this.program, {
      visitExportNamedDeclaration:
          (path: AstPath<estree.ExportNamedDeclaration>) => {
            if (path.node.declaration &&
                path.node.declaration.type === 'FunctionDeclaration') {
              this.rewriteSingleScopeThisReferences(
                  path.node.declaration.body, namespaceName);
            }
            return false;
          },
      visitExportDefaultDeclaration:
          (path: AstPath<estree.ExportDefaultDeclaration>) => {
            if (path.node.declaration &&
                path.node.declaration.type === 'FunctionDeclaration') {
              this.rewriteSingleScopeThisReferences(
                  path.node.declaration.body, namespaceName);
            }
            return false;
          },
    });
  }

  /**
   * Rewrite `this` references to the explicit namespaceReference identifier
   * within a single BlockStatement. Don't traverse deeper into new scopes.
   */
  private rewriteSingleScopeThisReferences(
      blockStatement: BlockStatement, namespaceReference: string) {
    astTypes.visit(blockStatement, {
      visitFunctionExpression(_path: AstPath<estree.FunctionExpression>) {
        // Don't visit into new scopes
        return false;
      },
      visitFunctionDeclaration(_path: AstPath<estree.FunctionDeclaration>) {
        // Don't visit into new scopes
        return false;
      },
      visitThisExpression(path: AstPath<estree.ThisExpression>) {
        path.replace(jsc.identifier(namespaceReference));
        return false;
      },
    });
  }

  /**
   * Injects JS imports at the top of the program based on html imports and
   * the imports in this.module.importedReferences.
   */
  private addJsImports(  //
      importedReferences: ReadonlyMap<string, ReadonlySet<string>>) {
    const baseUrl = this.document.url;
    const htmlImports = this.getHtmlImports();
    const jsImportUrls =
        new Set(htmlImports.map((s) => htmlUrlToJs(s.url, baseUrl)));

    // Rewrite HTML Imports to JS imports
    const jsImportDeclarations = [];
    for (const jsImportUrl of jsImportUrls) {
      const specifierNames = importedReferences.get(jsImportUrl);
      jsImportDeclarations.push(
          ...getImportDeclarations(jsImportUrl, specifierNames));
    }
    // Add JS imports for any implicit HTML imports
    for (const jsImplicitImportUrl of importedReferences.keys()) {
      if (!jsImportUrls.has(jsImplicitImportUrl)) {
        const specifierNames = importedReferences.get(jsImplicitImportUrl);
        jsImportDeclarations.push(
            ...getImportDeclarations(jsImplicitImportUrl, specifierNames));
      }
    }

    this.program.body.splice(0, 0, ...jsImportDeclarations);
    return jsImportDeclarations.length > 0;
  }

  /**
   * Mutates this.program to unwrap the toplevel IIFE if there is one.
   * This assumes that the IIFE is an intentionally scoped ES5 module body.
   */
  private unwrapIIFEPeusdoModule() {
    if (this.program.body.length === 1 &&
        this.program.body[0].type === 'ExpressionStatement') {
      const statement = this.program.body[0];
      if (statement.type === 'ExpressionStatement' &&
          statement.expression.type === 'CallExpression') {
        const callee = statement.expression.callee;
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

  private isNamespace(node: Node) {
    const namespaces = this.document.getFeatures({kind: 'namespace'});
    for (const namespace of namespaces) {
      if (sourceLocationsEqual(namespace.astNode, node)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Find the node in this.program that corresponds to the same part of code
   * as the given node.
   *
   * This method is necessary because this.program is parsed locally, but the
   * given node may have come from the analyzer (so a different parse run,
   * possibly by a different parser, though they output the same format).
   */
  private getNode(node: Node) {
    let associatedNode: Node|undefined;

    astTypes.visit(this.program, {
      visitNode(path: AstPath<Node>): boolean |
      undefined {
        if (sourceLocationsEqual(path.node, node)) {
          associatedNode = path.node;
          return false;
        }
        this.traverse(path);
        return undefined;
      }
    });

    return associatedNode;
  }
}

/**
 * Returns export declarations for each of a namespace objects members.
 *
 * Pure, does no mutation.
 */
function getNamespaceExports(
    namespace: ObjectExpression, mutableExports?: ReadonlyArray<string>) {
  const exportRecords: {name: string, node: Node}[] = [];

  for (const {key, value} of namespace.properties) {
    if (key.type !== 'Identifier') {
      console.warn(`unsupported namespace property type ${key.type}`);
      continue;
    }
    const name = key.name;
    if (value.type === 'ObjectExpression' || value.type === 'ArrayExpression' ||
        value.type === 'Literal') {
      const isMutable = !!(mutableExports && mutableExports.includes(name));
      exportRecords.push({
        name,
        node: jsc.exportNamedDeclaration(jsc.variableDeclaration(
            isMutable ? 'let' : 'const', [jsc.variableDeclarator(key, value)]))
      });
    } else if (value.type === 'FunctionExpression') {
      const func = value;
      exportRecords.push({
        name,
        node: jsc.exportNamedDeclaration(jsc.functionDeclaration(
            key,  // id
            func.params,
            func.body,
            func.generator))
      });
    } else if (value.type === 'ArrowFunctionExpression') {
      exportRecords.push({
        name,
        node: jsc.exportNamedDeclaration(jsc.variableDeclaration(
            'const', [jsc.variableDeclarator(key, value)]))
      });
    } else if (value.type === 'Identifier') {
      exportRecords.push({
        name,
        node: jsc.exportNamedDeclaration(
            null,
            [jsc.exportSpecifier(jsc.identifier(name), jsc.identifier(name))]),
      });
    } else {
      console.warn('Namespace property not handled:', name, value);
    }
  }

  return exportRecords;
}

/**
 * Returns true if a statement is the literal "use strict".
 */
function isUseStrict(statement: Statement) {
  return statement.type === 'ExpressionStatement' &&
      statement.expression.type === 'Literal' &&
      statement.expression.value === 'use strict';
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
function getExport(
    statement: Statement|ModuleDeclaration, namespaces: ReadonlySet<string>):
    {namespace: string[], value: Expression}|undefined {
  if (!(statement.type === 'ExpressionStatement' &&
        statement.expression.type === 'AssignmentExpression')) {
    return undefined;
  }
  const assignment = statement.expression;
  if (!(assignment.left.type === 'MemberExpression')) {
    return undefined;
  }

  const namespace = getMemberPath(assignment.left);

  if (namespace !== undefined && namespaces.has(namespace[0])) {
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
export function getMemberPath(expression: Node): string[]|undefined {
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

function* enumerate<V>(iter: Iterable<V>): Iterable<[number, V]> {
  let i = 0;
  for (const val of iter) {
    yield [i, val];
    i++;
  }
}

const legacyJavascriptTypes: ReadonlySet<string|null> = new Set([
  // lol
  // https://dev.w3.org/html5/spec-preview/the-script-element.html#scriptingLanguages
  null,
  '',
  'application/ecmascript',
  'application/javascript',
  'application/x-ecmascript',
  'application/x-javascript',
  'text/ecmascript',
  'text/javascript',
  'text/javascript1.0',
  'text/javascript1.1',
  'text/javascript1.2',
  'text/javascript1.3',
  'text/javascript1.4',
  'text/javascript1.5',
  'text/jscript',
  'text/livescript',
  'text/x-ecmascript',
  'text/x-javascript',
]);
function isLegacyJavascriptTag(scriptNode: parse5.ASTNode) {
  if (scriptNode.tagName !== 'script') {
    return false;
  }
  return legacyJavascriptTypes.has(dom5.getAttribute(scriptNode, 'type'));
}
