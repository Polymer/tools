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

import {JsExport, JsModule, NamespaceMemberToExport} from './js-module';
import {removeWrappingIIFE} from './passes/remove-wrapping-iife';
import {ConvertedDocumentUrl, convertHtmlDocumentUrl, convertJsDocumentUrl, getDocumentUrl, getRelativeUrl, OriginalDocumentUrl} from './url-converter';
import {findAvailableIdentifier, getMemberName, getMemberPath, getModuleId, getNodeGivenAnalyzerAstNode, nodeToTemplateLiteral, serializeNode} from './util';

import jsc = require('jscodeshift');
import {rewriteNamespacesAsExports} from './passes/rewrite-namespace-exports';
import {removeUnnecessaryEventListeners} from './passes/remove-unnecessary-waits';
import {ConverterMetadata} from './converter-metadata';
import {removeNamespaceInitializers} from './passes/remove-namespace-initializers';

/**
 * Pairs a subtree of an AST (`path` as a `NodePath`) to be replaced with a
 * reference to a particular import binding represented by the JSExport
 * `target`.
 */
type ImportReference = {
  path: NodePath,
  target: JsExport,
};

/** Represents a change to a portion of a file. */
interface Edit {
  offsets: [number, number];
  replacementText: string;
}

/**
 * Convert a module specifier & an optional set of named exports (or '*' to
 * import entire namespace) to a set of ImportDeclaration objects.
 */
function getImportDeclarations(
    specifierUrl: string,
    namedImports: Iterable<JsExport>,
    importReferences: ReadonlySet<ImportReference> = new Set(),
    usedIdentifiers: Set<string> = new Set()): ImportDeclaration[] {
  // A map from imports (as `JsExport`s) to their assigned specifier names.
  const assignedNames = new Map<JsExport, string>();
  // Find an unused identifier and mark it as used.
  function assignAlias(import_: JsExport, requestedAlias: string) {
    const alias = findAvailableIdentifier(requestedAlias, usedIdentifiers);
    usedIdentifiers.add(alias);
    assignedNames.set(import_, alias);
    return alias;
  }

  const namedImportsArray = Array.from(namedImports);
  const namedSpecifiers =
      namedImportsArray.filter((import_) => import_.name !== '*')
          .map((import_) => {
            const name = import_.name;
            const alias = assignAlias(import_, import_.name);

            if (alias === name) {
              return jsc.importSpecifier(jsc.identifier(name));
            } else {
              return jsc.importSpecifier(
                  jsc.identifier(name), jsc.identifier(alias));
            }
          });

  const importDeclarations: ImportDeclaration[] = [];

  // If a module namespace was referenced, create a new namespace import
  const namespaceImports =
      namedImportsArray.filter((import_) => import_.name === '*');
  if (namespaceImports.length > 1) {
    throw new Error(
        `More than one namespace import was given for '${specifierUrl}'.`);
  }

  const namespaceImport = namespaceImports[0];
  if (namespaceImport) {
    const alias = assignAlias(namespaceImport, getModuleId(specifierUrl));

    importDeclarations.push(jsc.importDeclaration(
        [jsc.importNamespaceSpecifier(jsc.identifier(alias))],
        jsc.literal(specifierUrl)));
  }

  // If any named imports were referenced, create a new import for all named
  // members. If `namedSpecifiers` is empty but a namespace wasn't imported
  // either, then still add an empty importDeclaration to trigger the load.
  if (namedSpecifiers.length > 0 || namespaceImport === undefined) {
    importDeclarations.push(
        jsc.importDeclaration(namedSpecifiers, jsc.literal(specifierUrl)));
  }

  // Replace all references to all imports with the assigned name for each
  // import.
  for (const {target, path} of importReferences) {
    const assignedName = assignedNames.get(target);
    if (!assignedName) {
      throw new Error(
          `The import '${target.name}' was not assigned an identifier.`);
    }

    path.replace(jsc.identifier(assignedName));
  }

  return importDeclarations;
}


const elementBlacklist = new Set<string|undefined>([
  'base',
  'link',
  'meta',
  'script',
]);


/**
 * Converts a Document and its dependencies.
 */
export class DocumentConverter {
  private readonly originalUrl: OriginalDocumentUrl;
  private readonly convertedUrl: ConvertedDocumentUrl;
  private readonly analysisConverter: ConverterMetadata;
  private readonly document: Document;
  private readonly _mutableExports:
      {readonly [namespaceName: string]: ReadonlyArray<string>};

  private readonly packageName: string;
  private readonly packageType: 'element'|'application';

  // Dependencies not to convert, because they already have been / are currently
  // being converted.
  private readonly visited: Set<OriginalDocumentUrl>;
  constructor(
      analysisConverter: ConverterMetadata, document: Document,
      packageName: string, packageType: 'element'|'application',
      visited: Set<OriginalDocumentUrl>) {
    this.analysisConverter = analysisConverter;
    this._mutableExports =
        Object.assign({}, this.analysisConverter.mutableExports!);
    this.document = document;
    this.originalUrl = getDocumentUrl(document);
    this.convertedUrl = convertHtmlDocumentUrl(this.originalUrl);
    this.packageName = packageName;
    this.packageType = packageType;
    this.visited = visited;
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
                !this.analysisConverter.excludes.has(f.document.url));
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
    removeUnnecessaryEventListeners(program);
    removeWrappingIIFE(program);
    const importedReferences = this.collectNamespacedReferences(program);
    // Add imports for every non-module <script> tag to just import the file
    // itself.
    for (const scriptImports of this.document.getFeatures(
             {kind: 'html-script'})) {
      const oldScriptUrl = getDocumentUrl(scriptImports.document);
      const newScriptUrl = convertJsDocumentUrl(oldScriptUrl);
      importedReferences.set(newScriptUrl, new Set());
    }
    this.addJsImports(program, importedReferences);
    this.insertCodeToGenerateHtmlElements(program);

    removeNamespaceInitializers(program, this.analysisConverter.namespaces);
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
    this.rewriteReferencesToLocalExports(program, exportMigrationRecords);
    this.rewriteReferencesToNamespaceMembers(program, new Set([
                                               ...localNamespaceNames,
                                               ...namespaceNames,
                                             ]));

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
    const htmlDocument = this.document.parsedDocument as ParsedHtmlDocument;

    const edits: Array<Edit> = [];
    for (const script of this.document.getFeatures({kind: 'js-document'})) {
      const astNode = script.astNode;
      if (!astNode || !isLegacyJavascriptTag(astNode)) {
        continue;  // ignore unknown script tags and preexisting modules
      }
      const sourceRange = script.astNode ?
          htmlDocument.sourceRangeForNode(script.astNode) :
          undefined;
      if (!sourceRange) {
        continue;  // nothing we can do about scripts without known positions
      }
      const offsets = htmlDocument.sourceRangeToOffsets(sourceRange);

      const file = recast.parse(script.parsedDocument.contents);
      const program = file.program;

      if (this.containsWriteToGlobalSettingsObject(program)) {
        continue;
      }

      removeUnnecessaryEventListeners(program);
      removeWrappingIIFE(program);
      const importedReferences = this.collectNamespacedReferences(program);
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
      this.rewriteReferencesToLocalExports(program, exportMigrationRecords);
      this.rewriteReferencesToNamespaceMembers(program, new Set([
                                                 ...localNamespaceNames,
                                                 ...namespaceNames,
                                               ]));
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
      const offsets = htmlDocument.sourceRangeToOffsets(htmlImport.sourceRange);

      const importedJsDocumentUrl =
          convertHtmlDocumentUrl(getDocumentUrl(htmlImport.document));
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
      // ignore fake script imports injected by various hacks in the
      // analyzer
      if (!scriptImport.sourceRange || !scriptImport.astNode) {
        continue;
      }
      if (!dom5.predicates.hasTagName('script')(scriptImport.astNode)) {
        throw new Error(
            `Expected an 'html-script' kinded feature to ` +
            `have a script tag for an AST node.`);
      }
      const offsets = htmlDocument.sourceRangeToOffsets(
          htmlDocument.sourceRangeForNode(scriptImport.astNode)!);

      const correctedUrl = this.formatImportUrl(
          convertHtmlDocumentUrl(getDocumentUrl(scriptImport.document)),
          scriptImport.url);
      dom5.setAttribute(scriptImport.astNode, 'src', correctedUrl);

      edits.push(
          {offsets, replacementText: serializeNode(scriptImport.astNode)});
    }

    // We need to ensure that custom styles are inserted into the document
    // *after* the styles they depend on are, which may have been imported.
    // We can depend on the fact that <script type="module"> tags are run in
    // order. So we'll convert all of the style tags into scripts that insert
    // those styles, ensuring that we also preserve the relative order of
    // styles.
    const p = dom5.predicates;
    const hasIncludedStyle = p.AND(
        p.hasTagName('style'),
        p.OR(
            p.hasAttrValue('is', 'custom-style'),
            p.parentMatches(p.hasTagName('custom-style'))),
        p.hasAttr('include'));

    if (dom5.nodeWalk(htmlDocument.ast, hasIncludedStyle)) {
      edits.push(...this.convertStylesToScriptsThatInsertThem(htmlDocument));
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

  private *
      convertStylesToScriptsThatInsertThem(htmlDocument: ParsedHtmlDocument):
          Iterable<Edit> {
    const p = dom5.predicates;
    const tagsToInsertImperatively = dom5.nodeWalkAll(
        htmlDocument.ast,
        p.OR(
            p.hasTagName('custom-style'),
            p.AND(
                p.hasTagName('style'),
                p.NOT(p.parentMatches(p.hasTagName('custom-style'))))));
    for (const tag of tagsToInsertImperatively) {
      const offsets = htmlDocument.sourceRangeToOffsets(
          htmlDocument.sourceRangeForNode(tag)!);
      const scriptTag = parse5.parseFragment(`<script type="module"></script>`)
                            .childNodes![0];
      const program = jsc.program(this.getCodeToInsertDomNodes([tag]));
      dom5.setTextContent(
          scriptTag,
          '\n' +
              recast
                  .print(
                      program, {quote: 'single', wrapColumn: 80, tabWidth: 2})
                  .code +
              '\n');
      const replacementText = serializeNode(scriptTag);
      yield {offsets, replacementText};
    }
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

    const usedDomModules =
        new Set([...this.document.getFeatures({kind: 'polymer-element'})].map(
            (el) => el.domModule));
    const genericElements = filterClone(
        elements,
        (e) => !(elementBlacklist.has(e.tagName) || usedDomModules.has(e)));

    if (genericElements.length === 0) {
      return;
    }
    const statements = this.getCodeToInsertDomNodes(genericElements);
    let insertionPoint = 0;
    for (const [idx, statement] of enumerate(program.body)) {
      insertionPoint = idx;
      if (statement.type === 'ImportDeclaration') {
        insertionPoint++;  // cover the case where the import is at the end
        continue;
      }
      break;
    }
    program.body.splice(insertionPoint, 0, ...statements);
  }

  private getCodeToInsertDomNodes(nodes: parse5.ASTNode[]): estree.Statement[] {
    const varName = `$_documentContainer`;
    const fragment = {
      nodeName: '#document-fragment',
      attrs: [],
      childNodes: nodes,
    };
    const templateValue = nodeToTemplateLiteral(fragment as any, false);

    return [
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
    this.visited.add(this.originalUrl);
    for (const htmlImport of this.getHtmlImports()) {
      const documentUrl = getDocumentUrl(htmlImport.document);
      const importedJsDocumentUrl = convertHtmlDocumentUrl(documentUrl);
      if (this.analysisConverter.modules.has(importedJsDocumentUrl)) {
        continue;
      }
      if (this.visited.has(documentUrl)) {
        console.warn(
            `Cycle in dependency graph found where ` +
            `${this.originalUrl} imports ${documentUrl}.\n` +
            `    html2js does not yet support rewriting references among ` +
            `cyclic dependencies.`);
        continue;
      }
      this.analysisConverter.convertDocument(htmlImport.document, this.visited);
    }
  }

  /**
   * Rewrite namespaced references to the imported name. e.g. changes
   * Polymer.Element -> $Element
   *
   * Returns a map of from url to identifier of the references we should
   * import.
   */
  private collectNamespacedReferences(program: Program):
      Map<ConvertedDocumentUrl, Set<ImportReference>> {
    const analysisConverter = this.analysisConverter;
    const importedReferences =
        new Map<ConvertedDocumentUrl, Set<ImportReference>>();

    /**
     * Add the given JsExport and referencing NodePath to this.module's
     * `importedReferences` map.
     */
    const addToImportedReferences = (target: JsExport, path: NodePath) => {
      let moduleImportedNames = importedReferences.get(target.url);
      if (moduleImportedNames === undefined) {
        moduleImportedNames = new Set<ImportReference>();
        importedReferences.set(target.url, moduleImportedNames);
      }
      moduleImportedNames.add({target, path});
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
        // Store the imported reference
        addToImportedReferences(exportOfMember, path);
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
          const [callPath] = assignmentPath.replace(jsc.callExpression(
              jsc.identifier(setterName), [assignmentPath.node.right]));
          if (!callPath) {
            throw new Error(
                'Failed to replace a namespace object property set with a setter function call.');
          }
          addToImportedReferences(exportOfMember, callPath.get('callee')!);
          return false;
        }
        const exportOfMember =
            analysisConverter.namespacedExports.get(memberName);
        if (!exportOfMember) {
          this.traverse(path);
          return;
        }
        // Store the imported reference
        addToImportedReferences(exportOfMember, path);
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
    const mapOfRewrites = new Map(this.analysisConverter.referenceRewrites);
    for (const reference of this.analysisConverter.referenceExcludes) {
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
      program: Program, namespaceNames: ReadonlySet<string>) {
    astTypes.visit(program, {
      visitMemberExpression(path: NodePath<MemberExpression>) {
        const memberPath = getMemberPath(path.node);
        if (memberPath) {
          const namespace = memberPath.slice(0, -1).join('.');
          if (namespaceNames.has(namespace)) {
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

  private rewriteReferencesToLocalExports(
      program: estree.Program,
      exportMigrationRecords: Iterable<NamespaceMemberToExport>) {
    const rewriteMap = new Map<string|undefined, string>(
        [...exportMigrationRecords]
            .filter((m) => m.es6ExportName !== '*')
            .map(
                (m) => [m.oldNamespacedName,
                        m.es6ExportName] as [string, string]));
    astTypes.visit(program, {
      visitMemberExpression(path: NodePath<MemberExpression>) {
        const memberName = getMemberName(path.node);
        const newLocalName = rewriteMap.get(memberName);
        if (newLocalName) {
          path.replace(jsc.identifier(newLocalName));
          return false;
        }
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
    const isPackageScoped = this.packageName.includes('/');
    const isPackageElement = this.packageType === 'element';
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
          ReadonlyMap<ConvertedDocumentUrl, ReadonlySet<ImportReference>>):
      boolean {
    // Collect Identifier nodes within trees that will be completely replaced
    // with an import reference.
    const ignoredIdentifiers: Set<Identifier> = new Set();
    for (const referenceSet of importedReferences.values()) {
      for (const reference of referenceSet) {
        astTypes.visit(reference.path.node, {
          visitIdentifier(path: NodePath<Identifier>): (boolean | void) {
            ignoredIdentifiers.add(path.node);
            this.traverse(path);
          },
        });
      }
    }
    const usedIdentifiers = collectIdentifierNames(program, ignoredIdentifiers);

    const jsExplicitImports = new Set<string>();
    // Rewrite HTML Imports to JS imports
    const jsImportDeclarations = [];
    for (const htmlImport of this.getHtmlImports()) {
      const importedJsDocumentUrl =
          convertHtmlDocumentUrl(getDocumentUrl(htmlImport.document));

      const references = importedReferences.get(importedJsDocumentUrl);
      const namedExports =
          new Set([...(references || [])].map((ref) => ref.target));

      const jsFormattedImportUrl =
          this.formatImportUrl(importedJsDocumentUrl, htmlImport.url);
      jsImportDeclarations.push(...getImportDeclarations(
          jsFormattedImportUrl, namedExports, references, usedIdentifiers));

      jsExplicitImports.add(importedJsDocumentUrl);
    }
    // Add JS imports for any additional, implicit HTML imports
    for (const jsImplicitImportUrl of importedReferences.keys()) {
      if (jsExplicitImports.has(jsImplicitImportUrl)) {
        continue;
      }

      const references = importedReferences.get(jsImplicitImportUrl);
      const namedExports =
          new Set([...(references || [])].map((ref) => ref.target));

      const jsFormattedImportUrl = this.formatImportUrl(jsImplicitImportUrl);
      jsImportDeclarations.push(...getImportDeclarations(
          jsFormattedImportUrl, namedExports, references, usedIdentifiers));
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

function filterClone(
    nodes: parse5.ASTNode[], filter: dom5.Predicate): parse5.ASTNode[] {
  const clones = [];
  for (const node of nodes) {
    if (!filter(node)) {
      continue;
    }
    const clone = dom5.cloneNode(node);
    clones.push(clone);
    if (node.childNodes) {
      clone.childNodes = filterClone(node.childNodes, filter);
    }
  }
  return clones;
}

/**
 * Finds all identifiers within the given program and creates a set of their
 * names (strings). Identifiers in the `ignored` argument set will not
 * contribute to the output set.
 */
function collectIdentifierNames(
    program: estree.Program, ignored: ReadonlySet<Identifier>): Set<string> {
  const identifiers = new Set();
  astTypes.visit(program, {
    visitIdentifier(path: NodePath<Identifier>): (boolean | void) {
      const node = path.node;

      if (!ignored.has(node)) {
        identifiers.add(path.node.name);
      }

      this.traverse(path);
    },
  });
  return identifiers;
}
