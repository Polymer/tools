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
import {BlockStatement, Identifier, ImportDeclaration, MemberExpression, Node, Program} from 'estree';
import * as parse5 from 'parse5';
import * as path from 'path';
import {Document, Import, isPositionInsideRange, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';
import * as recast from 'recast';

import {AnalysisConverter} from './analysis-converter';
import {JsExport, JsModule} from './js-module';
import {removeWrappingIIFE} from './passes/remove-wrapping-iife';
import {convertDocumentUrl, ConvertedDocumentUrl, getDocumentUrl, getRelativeUrl, OriginalDocumentUrl} from './url-converter';
import {getImportAlias, getMemberPath, getModuleId, getNodeGivenAnalyzerAstNode, nodeToTemplateLiteral, serializeNode} from './util';

import jsc = require('jscodeshift');
import {rewriteNamespacesAsExports} from './passes/rewrite-namespace-exports';

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
        rewriteNamespacesAsExports(
            program,
            this.document,
            this._mutableExports,
            this.analysisConverter.namespaces);

    for (const namespaceName of namespaceNames) {
      this.rewriteNamespaceThisReferences(program, namespaceName);
    }
    this.rewriteExcludedReferences(program);
    this.rewriteReferencesToNamespaceMembers(
        program,
        new Set([
          ...localNamespaceNames,
          ...namespaceNames,
        ]),
        new Set([...exportMigrationRecords.map((r) => r.oldNamespacedName)]));

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

      const {localNamespaceNames, namespaceNames, exportMigrationRecords} =
          rewriteNamespacesAsExports(
              program,
              this.document,
              this._mutableExports,
              this.analysisConverter.namespaces);
      for (const namespaceName of namespaceNames) {
        this.rewriteNamespaceThisReferences(program, namespaceName);
      }
      this.rewriteExcludedReferences(program);
      this.rewriteReferencesToNamespaceMembers(
          program,
          new Set([
            ...localNamespaceNames,
            ...namespaceNames,
          ]),
          new Set([...exportMigrationRecords.map((r) => r.oldNamespacedName)]));
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
    for (const scriptImport of this.document.getFeatures(
             {kind: 'html-script'})) {
      if (!scriptImport.sourceRange || !scriptImport.astNode ||
          !dom5.predicates.hasTagName('script')(scriptImport.astNode) ||
          !scriptImport.document) {
        continue;
      }
      const containingHtmlDocument =
          this.document.parsedDocument as ParsedHtmlDocument;
      const rangeOfNode =
          containingHtmlDocument.sourceRangeForNode(scriptImport.astNode);
      if (!rangeOfNode) {
        continue;
      }
      const offsets = containingHtmlDocument.sourceRangeToOffsets(rangeOfNode);

      const correctedUrl = this.formatImportUrl(
          convertDocumentUrl(getDocumentUrl(scriptImport.document)),
          scriptImport.url);
      dom5.setAttribute(scriptImport.astNode, 'src', correctedUrl);

      edits.push(
          {offsets, replacementText: serializeNode(scriptImport.astNode)});
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
      const node = getNodeGivenAnalyzerAstNode(program, element.astNode);

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
                                  templateLiteral)])),
                true));
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
        const assignmentPath = getPathOfAssignmentTo(path);
        if (assignmentPath) {
          const setterName = getSetterName(memberPath);
          const exportOfMember =
              analysisConverter.namespacedExports.get(setterName);
          if (!exportOfMember) {
            // warn about writing to an exported value without a setter?
            this.traverse(path);
            return;
          }
          addToImportedReferences(exportOfMember);
          assignmentPath.replace(jsc.callExpression(
              exportOfMember.expressionToAccess(),
              [assignmentPath.node.right]));
          return false;
        }
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

    /**
     * Rewrite the given path of the given member by `mapOfRewrites`.
     *
     * Never rewrite an assignment to assign to `undefined`.
     */
    const rewrite = (path: NodePath, memberName: string) => {
      const replacement = mapOfRewrites.get(memberName);
      if (replacement) {
        if (replacement.type === 'Identifier' &&
            replacement.name === 'undefined' && isAssigningTo(path)) {
          /**
           * If `path` is a name / pattern that's being written to, we don't
           * want to rewrite it to `undefined`.
           */
          return;
        }
        path.replace(replacement);
      }
    };

    astTypes.visit(program, {
      visitMemberExpression(path: NodePath<MemberExpression>) {
        const memberPath = getMemberPath(path.node);
        if (memberPath !== undefined) {
          rewrite(path, memberPath.join('.'));
        }
        this.traverse(path);
      },
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
  private rewriteReferencesToNamespaceMembers(
      program: Program, namespaceNames: ReadonlySet<string>,
      namespaceMembers: ReadonlySet<string>) {
    astTypes.visit(program, {
      visitMemberExpression(path: NodePath<MemberExpression>) {
        const memberPath = getMemberPath(path.node);
        if (memberPath) {
          const namespace = memberPath.slice(0, -1).join('.');
          const fullyQualifiedName = memberPath.join('.');
          if (namespaceNames.has(namespace) ||
              namespaceMembers.has(fullyQualifiedName)) {
            path.replace(path.node.property);
            return false;
          }
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
      visitThisExpression(path: NodePath<estree.ThisExpression>) {
        path.replace(jsc.identifier(namespaceReference));
        return false;
      },

      visitFunctionExpression(_path: NodePath<estree.FunctionExpression>) {
        // Don't visit into new scopes
        return false;
      },
      visitFunctionDeclaration(_path: NodePath<estree.FunctionDeclaration>) {
        // Don't visit into new scopes
        return false;
      },
      visitMethodDefinition(_path: NodePath) {
        // Don't visit into new scopes
        return false;
      },
      // Note: we do visit into ArrowFunctionExpressions because they
      //     inherit the containing `this` context.
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

/**
 * Returns true iff the given NodePath is assigned to in an assignment
 * expression in the following examples, `foo` is an Identifier that's assigned
 * to:
 *
 *    foo = 10;
 *    window.foo = 10;
 *
 * And in these examples `foo` is not:
 *
 *     bar = foo;
 *     foo();
 *     const foo = 10;
 *     this.foo = 10;
 */
function isAssigningTo(path: NodePath): boolean {
  return getPathOfAssignmentTo(path) !== undefined;
}

/**
 * Like isAssigningTo, but returns the NodePath of the assignment rather than
 * true, and undefined rather than false.
 */
function getPathOfAssignmentTo(path: NodePath):
    NodePath<estree.AssignmentExpression>|undefined {
  if (!path.parent) {
    return undefined;
  }
  const parentNode = path.parent.node;
  if (parentNode.type === 'AssignmentExpression') {
    if (parentNode.left === path.node) {
      return path.parent as NodePath<estree.AssignmentExpression>;
    }
    return undefined;
  }
  if (parentNode.type === 'MemberExpression' &&
      parentNode.property === path.node &&
      parentNode.object.type === 'Identifier' &&
      parentNode.object.name === 'window') {
    return getPathOfAssignmentTo(path.parent);
  }
  return undefined;
}

/**
 * Give the name of the setter we should use to set the given memberPath. Does
 * not check to see if the setter exists, just returns the name it would have.
 * e.g.
 *
 *     ['Polymer', 'foo', 'bar']    =>    'Polymer.foo.setBar'
 */
function getSetterName(memberPath: string[]): string {
  const lastSegment = memberPath[memberPath.length - 1];
  memberPath[memberPath.length - 1] =
      `set${lastSegment.charAt(0).toUpperCase()}${lastSegment.slice(1)}`;
  return memberPath.join('.');
}
