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

import * as astTypes from 'ast-types';
import {NodePath} from 'ast-types';
import * as dom5 from 'dom5';
import * as estree from 'estree';
import {BlockStatement, Expression, Identifier, ImportDeclaration, MemberExpression, Node, ObjectExpression, Program} from 'estree';
import * as parse5 from 'parse5';
import * as path from 'path';
import {Document, Import, isPositionInsideRange, Severity, Warning} from 'polymer-analyzer';
import * as recast from 'recast';

import {AnalysisConverter} from './analysis-converter';
import {JsExport, JsModule, NamespaceMemberToExport} from './js-module';
import {removeWrappingIIFE} from './passes/remove-wrapping-iife';
import {convertDocumentUrl, ConvertedDocumentUrl, getDocumentUrl, getRelativeUrl, OriginalDocumentUrl} from './url-converter';
import {getImportAlias, getModuleId, nodeToTemplateLiteral, serializeNode, sourceLocationsEqual} from './util';

import jsc = require('jscodeshift');

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
  private readonly originalUrl: OriginalDocumentUrl;
  private readonly convertedUrl: ConvertedDocumentUrl;
  private readonly analysisConverter: AnalysisConverter;
  private readonly document: Document;
  private readonly _mutableExports:
      {readonly [namespaceName: string]: ReadonlyArray<string>};

  constructor(analysisConverter: AnalysisConverter, document: Document) {
    this.analysisConverter = analysisConverter;
    this._mutableExports =
        Object.assign({}, this.analysisConverter._mutableExports!);
    this.document = document;
    this.originalUrl = getDocumentUrl(document);
    this.convertedUrl = convertDocumentUrl(this.originalUrl);
  }

  /**
   * Returns the HTML Imports of a document, except imports to documents
   * specifically excluded in the AnalysisConverter.
   *
   * Note: Imports that are not found are not returned by the analyzer.
   */
  private getHtmlImports() {
    return Array.from(this.document.getFeatures({kind: 'html-import'}))
        .filter(
            (f: Import) =>
                !this.analysisConverter._excludes.has(f.document.url));
  }

  convertToJsModule(): Iterable<JsModule> {
    const combinedToplevelStatements = [];
    for (const script of this.document.getFeatures({kind: 'js-document'})) {
      const scriptProgram =
          recast.parse(script.parsedDocument.contents).program;
      // We need to inline templates on a per-script basis, otherwise we run
      // into trouble matching up analyzer AST nodes with our own.
      this.inlineTemplates(scriptProgram, script);
      combinedToplevelStatements.push(...scriptProgram.body);
    }
    const program = jsc.program(combinedToplevelStatements);
    this.convertDependencies();
    removeWrappingIIFE(program);
    const importedReferences = this.rewriteNamespacedReferences(program);
    this.addJsImports(program, importedReferences);
    this.insertCodeToGenerateHtmlElements(program);

    const {localNamespaceNames, namespaceNames, exportMigrationRecords} =
        this.rewriteNamespaceExports(program);

    for (const namespaceName of namespaceNames) {
      this.rewriteNamespaceThisReferences(program, namespaceName);
    }
    for (const localNamespacename of localNamespaceNames) {
      this.rewriteReferencesToTheLocallyDefinedNamespace(
          program, localNamespacename);
    }
    for (const namespaceName of namespaceNames) {
      this.rewriteReferencesToTheLocallyDefinedNamespace(
          program, namespaceName);
    }
    this.rewriteExcludedReferences(program);
    this.warnOnDangerousReferences(program);

    const outputProgram =
        recast.print(program, {quote: 'single', wrapColumn: 80, tabWidth: 2});
    return [{
      url: this.convertedUrl,
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
      const program = file.program;

      if (this.containsWriteToGlobalSettingsObject(program)) {
        continue;
      }

      removeWrappingIIFE(program);
      const importedReferences = this.rewriteNamespacedReferences(program);
      const wereImportsAdded = this.addJsImports(program, importedReferences);
      // Don't convert the HTML.
      // Don't inline templates, they're fine where they are.

      const {localNamespaceNames, namespaceNames} =
          this.rewriteNamespaceExports(program);
      for (const namespaceName of namespaceNames) {
        this.rewriteNamespaceThisReferences(program, namespaceName);
      }
      for (const localNamespaceName of localNamespaceNames) {
        this.rewriteReferencesToTheLocallyDefinedNamespace(
            program, localNamespaceName);
      }
      for (const namespaceName of namespaceNames) {
        this.rewriteReferencesToTheLocallyDefinedNamespace(
            program, namespaceName);
      }
      this.rewriteExcludedReferences(program);


      this.rewriteExcludedReferences(program);
      this.warnOnDangerousReferences(program);

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
                      program, {quote: 'single', wrapColumn: 80, tabWidth: 2})
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

      const importedJsDocumentUrl =
          convertDocumentUrl(getDocumentUrl(htmlImport.document));
      const importUrl =
          this.formatImportUrl(importedJsDocumentUrl, htmlImport.url);
      const scriptTag = parse5.parseFragment(`<script type="module"></script>`)
                            .childNodes![0];
      dom5.setAttribute(scriptTag, 'src', importUrl);
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
      url: ('./' + this.originalUrl) as ConvertedDocumentUrl,
      source: contents,
      exportedNamespaceMembers: [],
      es6Exports: new Set()
    }];
  }

  private containsWriteToGlobalSettingsObject(program: Program) {
    let containsWriteToGlobalSettingsObject = false;
    // Note that we look for writes to these objects exactly, not to writes to
    // members of these objects.
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
    astTypes.visit(program, {
      visitAssignmentExpression(path: NodePath<estree.AssignmentExpression>) {
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
   * code to the top of program that constructs equivalent DOM and insert
   * it into `window.document`.
   */
  private insertCodeToGenerateHtmlElements(program: Program) {
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
    for (const [idx, statement] of enumerate(program.body)) {
      if (statement.type === 'ImportDeclaration') {
        continue;
      }
      // First statement past the imports.
      insertionPoint = idx;
      break;
    }
    program.body.splice(insertionPoint, 0, ...statements);
  }

  /**
   * Find places in program that look like they're exporting symbols by
   * writing them onto namespaces. Transform these into ES6 module exports.
   */
  private rewriteNamespaceExports(program: Program) {
    const exportMigrationRecords: NamespaceMemberToExport[] = [];
    const localNamespaceNames: ReadonlySet<string> =
        new Set(getLocalNamesOfLocallyDeclaredNamespaces(this.document));
    const namespaceNames = new Set<string>();

    const newRewriteNamespaceObject =
        (name: string, body: ObjectExpression, path: NodePath) => {
          const mutableExports = this._mutableExports[name];
          const namespaceExports = getNamespaceExports(body, mutableExports);

          for (const {node} of namespaceExports) {
            path.insertBefore(node);
          }
          path.prune();

          for (const e of namespaceExports) {
            exportMigrationRecords.push({
              oldNamespacedName: `${name}.${e.name}`,
              es6ExportName: e.name
            });
          }
          exportMigrationRecords.push(
              {oldNamespacedName: name, es6ExportName: '*'});
        };

    const handleApparentExports =
        (path: NodePath,
         exportedExpression: estree.Expression,
         namespaceMemberPath: string[]) => {
          const namespaceName = namespaceMemberPath.join('.');
          namespaceNames.add(namespaceName);
          if (this.isNamespace(path.node) &&
              exportedExpression.type === 'ObjectExpression') {
            newRewriteNamespaceObject(namespaceName, exportedExpression, path);
          } else if (exportedExpression.type === 'Identifier') {
            // An 'export' of the form:
            // Polymer.Foo = Foo;
            // TODO(justinfagnani): generalize to handle namespaces and other
            // declarations
            const localName = exportedExpression;

            const namespaceFeatures = this.document.getFeatures(
                {id: namespaceName, kind: 'namespace'});

            if (namespaceFeatures.size > 0) {
              // // Polymer.X = X; where X is previously defined as a namespace

              const [namespaceFeature] = this.document.getFeatures(
                  {id: namespaceName, kind: 'namespace'});

              // Find the namespace node and containing statement
              const namespaceDeclarationStatement =
                  this.getNodePath(program, namespaceFeature.astNode);
              if (namespaceDeclarationStatement == null) {
                throw new Error(`can't find associated node for namespace`);
              }
              const namespaceDeclarationValue =
                  getAssignmentValue(namespaceDeclarationStatement.node);
              if (!namespaceDeclarationValue ||
                  namespaceDeclarationValue.type !== 'ObjectExpression') {
                return;
              }
              newRewriteNamespaceObject(
                  namespaceName,
                  namespaceDeclarationValue,
                  namespaceDeclarationStatement);

              // Remove the namespace assignment
              path.prune();
            } else {
              // Not a namespace, fallback to a named export
              // We could probably do better for referenced declarations, ie
              // move the export to the declaration
              const exportedName =
                  namespaceMemberPath[namespaceMemberPath.length - 1];
              path.replace(jsc.exportNamedDeclaration(
                  null,  // declaration
                  [jsc.exportSpecifier(
                      localName, jsc.identifier(exportedName))]));
              exportMigrationRecords.push({
                es6ExportName: exportedName,
                oldNamespacedName: namespaceName
              });
            }
          } else {
            let name = namespaceMemberPath[namespaceMemberPath.length - 1];
            // Special Polymer workaround: Register & rewrite the
            // `Polymer._polymerFn` export as if it were the `Polymer()`
            // namespace function.
            let correctedNamespaceName = namespaceName;
            if (namespaceName === 'Polymer._polymerFn') {
              correctedNamespaceName = 'Polymer';
              name = 'Polymer';
            }
            path.replace(jsc.exportNamedDeclaration(jsc.variableDeclaration(
                'const', [jsc.variableDeclarator(
                             jsc.identifier(name), exportedExpression)])));
            exportMigrationRecords.push({
              oldNamespacedName: correctedNamespaceName,
              es6ExportName: name
            });
          }
        };

    visitToplevelStatements(program, (path: NodePath<Node>) => {
      const statement = path.node;
      const exported = getExport(statement, this.analysisConverter.namespaces);
      if (exported !== undefined) {
        const {namespace: namespaceMemberPath, value} = exported;
        handleApparentExports(path, value, namespaceMemberPath);
        return;
      } else {
        const namespaceAssignment = getExport(statement, localNamespaceNames);

        if (namespaceAssignment !== undefined) {
          const {namespace, value} = namespaceAssignment;
          const name = namespace[namespace.length - 1];
          const namespaceName = namespace.join('.');
          namespaceNames.add(namespaceName);

          path.replace(jsc.exportNamedDeclaration(jsc.variableDeclaration(
              'const', [jsc.variableDeclarator(jsc.identifier(name), value)])));
          exportMigrationRecords.push(
              {oldNamespacedName: namespaceName, es6ExportName: name});
        }
      }
    });

    return {
      localNamespaceNames,
      namespaceNames,
      exportMigrationRecords,
    };
  }

  /**
   * Find Polymer element templates in the original HTML. Insert these
   * templates as strings as part of the javascript element declaration.
   */
  private inlineTemplates(program: Program, scriptDocument: Document) {
    const elements = scriptDocument.getFeatures({'kind': 'polymer-element'});

    for (const element of elements) {
      // This is an analyzer wart. There's no way to avoid getting features
      // from the containing document when querying an inline document. Filed
      // as https://github.com/Polymer/polymer-analyzer/issues/712
      if (element.sourceRange === undefined ||
          !isPositionInsideRange(
              element.sourceRange.start, scriptDocument.sourceRange)) {
        continue;
      }
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
      const node = this.getNode(program, element.astNode);

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
      const importedJsDocumentUrl =
          convertDocumentUrl(getDocumentUrl(htmlImport.document));
      if (this.analysisConverter.modules.has(importedJsDocumentUrl)) {
        continue;
      }
      this.analysisConverter.convertDocument(htmlImport.document);
    }
  }

  /**
   * Rewrite namespaced references to the imported name. e.g. changes
   * Polymer.Element -> $Element
   *
   * Returns a map of from url to identifier of the references we should
   * import.
   */
  private rewriteNamespacedReferences(program: Program) {
    const analysisConverter = this.analysisConverter;
    const importedReferences = new Map<ConvertedDocumentUrl, Set<string>>();

    /**
     * Add the given JsExport to this.module's `importedReferences` map.
     */
    const addToImportedReferences = (moduleExport: JsExport) => {
      let moduleImportedNames = importedReferences.get(moduleExport.url);
      if (moduleImportedNames === undefined) {
        moduleImportedNames = new Set<string>();
        importedReferences.set(moduleExport.url, moduleImportedNames);
      }
      moduleImportedNames.add(moduleExport.name);
    };

    astTypes.visit(program, {
      visitIdentifier(path: NodePath<Identifier>) {
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
      visitMemberExpression(path: NodePath<MemberExpression>) {
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
  private rewriteExcludedReferences(program: Program) {
    const mapOfRewrites = new Map(this.analysisConverter._referenceRewrites);
    for (const reference of this.analysisConverter._referenceExcludes) {
      mapOfRewrites.set(reference, jsc.identifier('undefined'));
    }

    astTypes.visit(program, {
      visitMemberExpression(path: NodePath<MemberExpression>) {
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

  private warnOnDangerousReferences(program: Program) {
    const dangerousReferences = this.analysisConverter.dangerousReferences;
    const originalUrl = this.originalUrl;
    astTypes.visit(program, {
      visitMemberExpression(path: NodePath<MemberExpression>) {
        const memberPath = getMemberPath(path.node);
        if (memberPath !== undefined) {
          const memberName = memberPath.join('.');
          const warningMessage = dangerousReferences.get(memberName);
          if (warningMessage) {
            // TODO(rictic): track the relationship between the programs and
            // documents so we can display real Warnings here.
            console.warn(`Issue in ${originalUrl}: ${warningMessage}`);
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
      program: Program, namespaceName?: string) {
    if (namespaceName === undefined) {
      return;
    }
    astTypes.visit(program, {
      visitMemberExpression(path: NodePath<MemberExpression>) {
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
   * Rewrite `this` references that refer to the namespace object. Replace
   * with an explicit reference to the namespace. This simplifies the rest of
   * our transform pipeline by letting it assume that all namespace references
   * are explicit.
   *
   * NOTE(fks): References to the namespace object still need to be corrected
   * after this step, so timing is important: Only run after exports have
   * been created, but before all namespace references are corrected.
   */
  private rewriteNamespaceThisReferences(
      program: Program, namespaceName?: string) {
    if (namespaceName === undefined) {
      return;
    }
    astTypes.visit(program, {
      visitExportNamedDeclaration:
          (path: NodePath<estree.ExportNamedDeclaration>) => {
            if (path.node.declaration &&
                path.node.declaration.type === 'FunctionDeclaration') {
              this.rewriteSingleScopeThisReferences(
                  path.node.declaration.body, namespaceName);
            }
            return false;
          },
      visitExportDefaultDeclaration:
          (path: NodePath<estree.ExportDefaultDeclaration>) => {
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
      visitFunctionExpression(_path: NodePath<estree.FunctionExpression>) {
        // Don't visit into new scopes
        return false;
      },
      visitFunctionDeclaration(_path: NodePath<estree.FunctionDeclaration>) {
        // Don't visit into new scopes
        return false;
      },
      visitThisExpression(path: NodePath<estree.ThisExpression>) {
        path.replace(jsc.identifier(namespaceReference));
        return false;
      },
    });
  }

  /**
   * Format an import from the current document to the given JS URL. If an
   * original HTML import URL is given, attempt to match the format of that
   * import URL as much as possible. For example, if the original import URL was
   * an absolute path, return an absolute path as well.
   */
  private formatImportUrl(
      jsRootUrl: ConvertedDocumentUrl, originalHtmlImportUrl?: string) {
    // Return an absolute URL path if the original HTML import was absolute
    if (originalHtmlImportUrl && path.posix.isAbsolute(originalHtmlImportUrl)) {
      return '/' + jsRootUrl.slice('./'.length);
    }
    // TODO(fks): Most of these can be calculated once and saved for later
    const isImportFromLocalFile =
        !this.convertedUrl.startsWith('./node_modules');
    const isImportToLocalFile = !jsRootUrl.startsWith('./node_modules');
    const isPackageScoped = this.analysisConverter.packageName.includes('/');
    const isPackageElement = this.analysisConverter.packageType === 'element';
    let importUrl = getRelativeUrl(this.convertedUrl, jsRootUrl);
    // If this document is an external dependency, or if this document is
    // importing a local file, just return normal relative URL between the two
    // files.
    if (!isImportFromLocalFile || isImportToLocalFile) {
      return importUrl;
    }
    // If the current project is an element, rewrite imports to point to
    // dependencies as if they were siblings.
    if (isPackageElement) {
      if (importUrl.startsWith('./node_modules/')) {
        importUrl = '../' + importUrl.slice('./node_modules/'.length);
      } else {
        importUrl = importUrl.replace('node_modules', '..');
      }
    }
    // If the current project has a scoped package name, account for the scoping
    // folder by referencing files up an additional level.
    if (isPackageScoped) {
      if (importUrl.startsWith('./')) {
        importUrl = '../' + importUrl.slice('./'.length);
      } else {
        importUrl = '../' + importUrl;
      }
    }
    return importUrl;
  }

  /**
   * Injects JS imports at the top of the program based on html imports and
   * the imports in this.module.importedReferences.
   */
  private addJsImports(
      program: Program,
      importedReferences:
          ReadonlyMap<ConvertedDocumentUrl, ReadonlySet<string>>): boolean {
    const jsExplicitImports = new Set<string>();
    // Rewrite HTML Imports to JS imports
    const jsImportDeclarations = [];
    for (const htmlImport of this.getHtmlImports()) {
      const importedJsDocumentUrl =
          convertDocumentUrl(getDocumentUrl(htmlImport.document));
      const specifierNames = importedReferences.get(importedJsDocumentUrl);
      const jsFormattedImportUrl =
          this.formatImportUrl(importedJsDocumentUrl, htmlImport.url);
      jsImportDeclarations.push(
          ...getImportDeclarations(jsFormattedImportUrl, specifierNames));
      jsExplicitImports.add(importedJsDocumentUrl);
    }
    // Add JS imports for any additional, implicit HTML imports
    for (const jsImplicitImportUrl of importedReferences.keys()) {
      if (!jsExplicitImports.has(jsImplicitImportUrl)) {
        const specifierNames = importedReferences.get(jsImplicitImportUrl);
        const jsFormattedImportUrl = this.formatImportUrl(jsImplicitImportUrl);
        jsImportDeclarations.push(
            ...getImportDeclarations(jsFormattedImportUrl, specifierNames));
      }
    }
    // Prepend JS imports into the program body
    program.body.splice(0, 0, ...jsImportDeclarations);
    // Return true if any imports were added, false otherwise
    return jsImportDeclarations.length > 0;
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
   * Find the node in program that corresponds to the same part of code
   * as the given node.
   *
   * This method is necessary because program is parsed locally, but the
   * given node may have come from the analyzer (so a different parse run,
   * possibly by a different parser, though they output the same format).
   */
  private getNode(program: Program, node: Node) {
    const associatedNodePath = this.getNodePath(program, node);
    if (associatedNodePath) {
      return associatedNodePath.node;
    }
    return;
  }

  private getNodePath(program: Program, node: Node) {
    let associatedNodePath: NodePath|undefined;

    astTypes.visit(program, {
      visitNode(path: NodePath<Node>): boolean |
      undefined {
        if (sourceLocationsEqual(path.node, node)) {
          associatedNodePath = path;
          return false;
        }
        this.traverse(path);
        return undefined;
      }
    });

    return associatedNodePath;
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
 * If a statement appears to be an export, returns the exported declaration.
 *
 * Implied exports are assignment expressions where the left hand side matches
 * some predicate to be refined later :)
 *
 * @param moduleRoot If specified
 */
function getExport(statement: estree.Node, namespaces: ReadonlySet<string>):
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
  if (expression.type !== 'MemberExpression' || expression.computed ||
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

function visitToplevelStatements(
    program: Program, cb: (path: NodePath) => void) {
  astTypes.visit(program, {
    visitNode(path: NodePath<Node>) {
      if (!path.parent) {
        // toplevel program
        this.traverse(path);
        return;
      }
      if (path.parent.node.type !== 'Program') {
        // not a toplevel statement, skip it
        return false;
      }
      this.traverse(path);

      // ok, path.node must be a toplevel statement of the program.
      cb(path);
      return;
    }
  });
}

function getAssignmentValue(node: estree.Node): estree.Expression|null|
    undefined {
  if (node.type === 'VariableDeclaration' && node.declarations.length > 0) {
    // case: const n = {...}
    return node.declarations[0].init;
  } else if (
      node.type === 'ExpressionStatement' &&
      node.expression.type === 'AssignmentExpression') {
    // case: n = {...}
    return node.expression.right;
  }
  return;
}

function* getLocalNamesOfLocallyDeclaredNamespaces(document: Document) {
  for (const namespace of document.getFeatures({kind: 'namespace'})) {
    if (namespace.astNode && namespace.astNode.type) {
      const astNode = namespace.astNode as estree.Node;
      if (astNode.type === 'VariableDeclaration') {
        const declaration = astNode.declarations[0];
        if (declaration.id.type === 'Identifier') {
          yield declaration.id.name;
        }
      }
    }
  }
}
