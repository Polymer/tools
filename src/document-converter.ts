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
import {Identifier, Program} from 'estree';
import {Iterable as IterableX} from 'ix';
import * as jsc from 'jscodeshift';
import * as parse5 from 'parse5';
import * as path from 'path';
import {Document, Import, isPositionInsideRange, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';
import * as recast from 'recast';

import {ConversionSettings} from './conversion-settings';
import {attachCommentsToFirstStatement, canDomModuleBeInlined, collectIdentifierNames, containsWriteToGlobalSettingsObject, createDomNodeInsertStatements, filterClone, findAvailableIdentifier, getCommentsBetween, getMemberPath, getNodePathInProgram, getPathOfAssignmentTo, getSetterName, insertStatementsIntoProgramBody, serializeNode, serializeNodeToTemplateLiteral} from './document-util';
import {ConversionResult, JsExport} from './js-module';
import {removeNamespaceInitializers} from './passes/remove-namespace-initializers';
import {removeUnnecessaryEventListeners} from './passes/remove-unnecessary-waits';
import {removeWrappingIIFEs} from './passes/remove-wrapping-iife';
import {rewriteExcludedReferences} from './passes/rewrite-excluded-references';
import {rewriteNamespacesAsExports} from './passes/rewrite-namespace-exports';
import {rewriteNamespacesThisReferences} from './passes/rewrite-namespace-this-references';
import {rewriteReferencesToLocalExports} from './passes/rewrite-references-to-local-exports';
import {rewriteReferencesToNamespaceMembers} from './passes/rewrite-references-to-namespace-members';
import {rewriteToplevelThis} from './passes/rewrite-toplevel-this';
import {ConvertedDocumentUrl, OriginalDocumentUrl} from './urls/types';
import {UrlHandler} from './urls/url-handler';
import {isOriginalDocumentUrlFormat} from './urls/util';
import {getDocumentUrl, getHtmlDocumentConvertedFilePath, getJsModuleConvertedFilePath, getModuleId, replaceHtmlExtensionIfFound} from './urls/util';

/**
 * Keep a map of dangerous references to check for. Output the related warning
 * message when one is found.
 */
const dangerousReferences = new Map<string, string>([
  [
    'document.currentScript',
    `document.currentScript is always \`null\` in an ES6 module.`
  ],
]);

/**
 * Keep a set of elements to ignore when Recreating HTML contents by adding
 * code to the top of a program.
 */
const generatedElementBlacklist = new Set<string|undefined>([
  'base',
  'link',
  'meta',
  'script',
]);

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

/**
 * Detect legacy JavaScript "type" attributes.
 */
function isLegacyJavaScriptTag(scriptNode: parse5.ASTNode) {
  if (scriptNode.tagName !== 'script') {
    return false;
  }
  return legacyJavascriptTypes.has(dom5.getAttribute(scriptNode, 'type'));
}

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
    usedIdentifiers: Set<string> = new Set()): estree.ImportDeclaration[] {
  // A map from imports (as `JsExport`s) to their assigned specifier names.
  const assignedNames = new Map<JsExport, string>();
  // Find an unused identifier and mark it as used.
  function assignAlias(import_: JsExport, requestedAlias: string) {
    const alias = findAvailableIdentifier(requestedAlias, usedIdentifiers);
    usedIdentifiers.add(alias);
    assignedNames.set(import_, alias);
    return alias;
  }

  const namedImportsArray = [...namedImports];
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

  const importDeclarations: estree.ImportDeclaration[] = [];

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

/**
 * Converts a Document from Bower to NPM. This supports converting HTML files
 * to JS Modules (using JavaScript import/export statements) or the more simple
 * HTML -> HTML conversion.
 */
export class DocumentConverter {
  private readonly originalUrl: OriginalDocumentUrl;
  private readonly convertedUrl: ConvertedDocumentUrl;
  private readonly urlHandler: UrlHandler;
  private readonly namespacedExports: Map<string, JsExport>;
  private readonly conversionSettings: ConversionSettings;
  private readonly document: Document;

  private readonly _claimedDomModules = new Set<parse5.ASTNode>();
  constructor(
      document: Document, namespacedExports: Map<string, JsExport>,
      urlHandler: UrlHandler, conversionSettings: ConversionSettings) {
    this.namespacedExports = namespacedExports;
    this.conversionSettings = conversionSettings;
    this.urlHandler = urlHandler;
    this.document = document;
    this.originalUrl = getDocumentUrl(document);
    this.convertedUrl = this.convertDocumentUrl(this.originalUrl);
  }

  /**
   * Returns ALL HTML Imports from a document. Note that this may return imports
   * to documents that are meant to be ignored/excluded during conversion. It
   * it is up to the caller to filter out any unneccesary/excluded documents.
   */
  static getAllHtmlImports(document: Document): Import[] {
    return [...document.getFeatures({kind: 'html-import'})];
  }

  /**
   * Returns the HTML Imports from a document, except imports to documents
   * specifically excluded in the ConversionSettings.
   *
   * Note: Imports that are not found are not returned by the analyzer.
   */
  private getHtmlImports() {
    return DocumentConverter.getAllHtmlImports(this.document)
        .filter(
            (f: Import) =>
                !this.conversionSettings.excludes.has(f.document.url));
  }

  convertToJsModule(): ConversionResult {
    const combinedToplevelStatements = [];
    let prevScriptNode: parse5.ASTNode|undefined = undefined;
    for (const script of this.document.getFeatures({kind: 'js-document'})) {
      const scriptProgram =
          recast.parse(script.parsedDocument.contents).program;
      rewriteToplevelThis(scriptProgram);
      // We need to inline templates on a per-script basis, otherwise we run
      // into trouble matching up analyzer AST nodes with our own.
      this.inlineTemplates(scriptProgram, script);
      if (this.conversionSettings.addImportPath) {
        this.addImportPathsToElements(scriptProgram, script);
      }
      const comments: string[] = getCommentsBetween(
          this.document.parsedDocument.ast, prevScriptNode, script.astNode);
      const statements =
          attachCommentsToFirstStatement(comments, scriptProgram.body);
      combinedToplevelStatements.push(...statements);
      prevScriptNode = script.astNode;
    }
    const trailingComments = getCommentsBetween(
        this.document.parsedDocument.ast, prevScriptNode, undefined);
    const maybeCommentStatement =
        attachCommentsToFirstStatement(trailingComments, []);
    combinedToplevelStatements.push(...maybeCommentStatement);
    const program = jsc.program(combinedToplevelStatements);
    removeUnnecessaryEventListeners(program);
    removeWrappingIIFEs(program);
    const importedReferences = this.collectNamespacedReferences(program);
    // Add imports for every non-module <script> tag to just import the file
    // itself.
    for (const scriptImports of this.document.getFeatures(
             {kind: 'html-script'})) {
      const oldScriptUrl = getDocumentUrl(scriptImports.document);
      const newScriptUrl = this.convertScriptUrl(oldScriptUrl);
      importedReferences.set(newScriptUrl, new Set());
    }
    this.addJsImports(program, importedReferences);
    this.insertCodeToGenerateHtmlElements(program);

    removeNamespaceInitializers(program, this.conversionSettings.namespaces);
    const {localNamespaceNames, namespaceNames, exportMigrationRecords} =
        rewriteNamespacesAsExports(
            program, this.document, this.conversionSettings.namespaces);
    const allNamespaceNames =
        new Set([...localNamespaceNames, ...namespaceNames]);
    rewriteNamespacesThisReferences(program, namespaceNames);
    rewriteExcludedReferences(program, this.conversionSettings);
    rewriteReferencesToLocalExports(program, exportMigrationRecords);
    rewriteReferencesToNamespaceMembers(program, allNamespaceNames);

    this.warnOnDangerousReferences(program);

    const outputProgram =
        recast.print(program, {quote: 'single', wrapColumn: 80, tabWidth: 2});

    return {
      originalUrl: this.originalUrl,
      convertedUrl: this.convertedUrl,
      convertedFilePath: getJsModuleConvertedFilePath(this.originalUrl),
      deleteOriginal: true,
      output: {
        type: 'js-module',
        source: outputProgram.code + '\n',
        exportedNamespaceMembers: exportMigrationRecords,
        es6Exports: new Set(exportMigrationRecords.map((r) => r.es6ExportName))
      }
    };
  }

  convertAsToplevelHtmlDocument(): ConversionResult {
    const htmlDocument = this.document.parsedDocument as ParsedHtmlDocument;
    const p = dom5.predicates;

    const edits: Array<Edit> = [];
    for (const script of this.document.getFeatures({kind: 'js-document'})) {
      const astNode = script.astNode;
      if (!astNode || !isLegacyJavaScriptTag(astNode)) {
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
      const program = this.rewriteInlineScript(file.program);

      if (program === undefined) {
        continue;
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

    const demoSnippetTemplates = dom5.nodeWalkAll(
        htmlDocument.ast,
        p.AND(
            p.hasTagName('template'),
            p.parentMatches(p.hasTagName('demo-snippet'))));
    const scriptsToConvert = [];
    for (const demoSnippetTemplate of demoSnippetTemplates) {
      scriptsToConvert.push(...dom5.nodeWalkAll(
          demoSnippetTemplate,
          p.hasTagName('script'),
          [],
          dom5.childNodesIncludeTemplate));
    }
    for (const astNode of scriptsToConvert) {
      if (!isLegacyJavaScriptTag(astNode)) {
        continue;
      }
      const sourceRange =
          astNode ? htmlDocument.sourceRangeForNode(astNode) : undefined;
      if (!sourceRange) {
        continue;  // nothing we can do about scripts without known positions
      }
      const offsets = htmlDocument.sourceRangeToOffsets(sourceRange);

      const file = recast.parse(dom5.getTextContent(astNode));
      const program = this.rewriteInlineScript(file.program);

      if (program === undefined) {
        continue;
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

    for (const htmlImport of this.getHtmlImports()) {
      // Only replace imports that are actually in the document.
      if (!htmlImport.sourceRange) {
        continue;
      }
      const offsets = htmlDocument.sourceRangeToOffsets(htmlImport.sourceRange);

      const htmlDocumentUrl = getDocumentUrl(htmlImport.document);
      const importedJsDocumentUrl = this.convertDocumentUrl(htmlDocumentUrl);
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
          this.convertDocumentUrl(getDocumentUrl(scriptImport.document)),
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

    return {
      originalUrl: this.originalUrl,
      convertedUrl: this.convertedUrl,
      convertedFilePath: getHtmlDocumentConvertedFilePath(this.originalUrl),
      output: {
        type: 'html-file',
        source: contents,
      }
    };
  }

  /**
   * Rewrite an inline script that will exist inlined inside an HTML document.
   * Should not be called on top-level JS Modules.
   */
  private rewriteInlineScript(program: Program) {
    // Any code that sets the global settings object cannot be inlined (and
    // deferred) because the settings object must be created/configured
    // before other imports evaluate in following module scripts.
    if (containsWriteToGlobalSettingsObject(program)) {
      return undefined;
    }

    rewriteToplevelThis(program);
    removeUnnecessaryEventListeners(program);
    removeWrappingIIFEs(program);
    const importedReferences = this.collectNamespacedReferences(program);
    const wereImportsAdded = this.addJsImports(program, importedReferences);
    // Don't convert the HTML.
    // Don't inline templates, they're fine where they are.

    const {localNamespaceNames, namespaceNames, exportMigrationRecords} =
        rewriteNamespacesAsExports(
            program, this.document, this.conversionSettings.namespaces);
    const allNamespaceNames =
        new Set([...localNamespaceNames, ...namespaceNames]);
    rewriteNamespacesThisReferences(program, namespaceNames);
    rewriteExcludedReferences(program, this.conversionSettings);
    rewriteReferencesToLocalExports(program, exportMigrationRecords);
    rewriteReferencesToNamespaceMembers(program, allNamespaceNames);

    this.warnOnDangerousReferences(program);

    if (!wereImportsAdded) {
      return undefined;  // no imports, no reason to convert to a module
    }

    return program;
  }

  private *
      convertStylesToScriptsThatInsertThem(htmlDocument: ParsedHtmlDocument):
          Iterable<Edit> {
    const p = dom5.predicates;
    const head = dom5.nodeWalk(htmlDocument.ast, p.hasTagName('head'));
    const body = dom5.nodeWalk(htmlDocument.ast, p.hasTagName('body'));
    if (head === null || body === null) {
      throw new Error(`HTML Parser error, got a document without a head/body?`);
    }

    const tagsToInsertImperatively = [
      ...dom5.nodeWalkAll(
          head,
          p.OR(
              p.hasTagName('custom-style'),
              p.AND(
                  p.hasTagName('style'),
                  p.NOT(p.parentMatches(p.hasTagName('custom-style')))))),
    ];

    const apology = `<!-- FIXME(polymer-modulizer):
        These imperative modules that innerHTML your HTML are
        a hacky way to be sure that any mixins in included style
        modules are ready before any elements that reference them are
        instantiated, otherwise the CSS @apply mixin polyfill won't be
        able to expand the underlying CSS custom properties.
        See: https://github.com/Polymer/polymer-modulizer/issues/154
        -->
    `;
    let first = true;
    for (const tag of tagsToInsertImperatively) {
      const offsets = htmlDocument.sourceRangeToOffsets(
          htmlDocument.sourceRangeForNode(tag)!);
      const scriptTag = parse5.parseFragment(`<script type="module"></script>`)
                            .childNodes![0];
      const program = jsc.program(createDomNodeInsertStatements([tag]));
      dom5.setTextContent(
          scriptTag,
          '\n' +
              recast
                  .print(
                      program, {quote: 'single', wrapColumn: 80, tabWidth: 2})
                  .code +
              '\n');
      let replacementText = serializeNode(scriptTag);
      if (first) {
        replacementText = apology + replacementText;
        first = false;
      }
      yield {offsets, replacementText};
    }

    for (const bodyNode of body.childNodes || []) {
      if (bodyNode.nodeName.startsWith('#') || bodyNode.tagName === 'script') {
        continue;
      }
      const offsets = htmlDocument.sourceRangeToOffsets(
          htmlDocument.sourceRangeForNode(bodyNode)!);
      const scriptTag = parse5.parseFragment(`<script type="module"></script>`)
                            .childNodes![0];
      const program =
          jsc.program(createDomNodeInsertStatements([bodyNode], true));
      dom5.setTextContent(
          scriptTag,
          '\n' +
              recast
                  .print(
                      program, {quote: 'single', wrapColumn: 80, tabWidth: 2})
                  .code +
              '\n');
      let replacementText = serializeNode(scriptTag);
      if (first) {
        replacementText = apology + replacementText;
        first = false;
      }
      yield {offsets, replacementText};
    }
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

    const genericElements = filterClone(
        elements,
        (e) =>
            !(generatedElementBlacklist.has(e.tagName) ||
              this._claimedDomModules.has(e)));

    if (genericElements.length === 0) {
      return;
    }
    const statements = createDomNodeInsertStatements(genericElements);
    insertStatementsIntoProgramBody(statements, program);
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
      if (!canDomModuleBeInlined(domModule)) {
        continue;
      }
      this._claimedDomModules.add(domModule);
      const template = dom5.query(domModule, (e) => e.tagName === 'template');
      if (template === null) {
        continue;
      }

      // It's ok to tag templates with the expression `Polymer.html` without
      // adding an import because `Polymer.html` is re-exported by both
      // polymer.html and polymer-element.html and, crucially, template
      // inlining happens before rewriting references.
      const templateLiteral = jsc.taggedTemplateExpression(
          jsc.memberExpression(
              jsc.identifier('Polymer'), jsc.identifier('html')),
          serializeNodeToTemplateLiteral(
              parse5.treeAdapters.default.getTemplateContent(template)));
      const nodePath = getNodePathInProgram(program, element.astNode);

      if (nodePath === undefined) {
        console.warn(
            new Warning({
              code: 'not-found',
              message: `Can't find recast node for element ${element.tagName}`,
              parsedDocument: this.document.parsedDocument,
              severity: Severity.WARNING,
              sourceRange: element.sourceRange!
            }).toString());
        continue;
      }

      const node = nodePath.node;
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
      } else {
        console.error(
            `Internal Error, Class or CallExpression expected, got ${
                                                                     node.type
                                                                   }`);
      }
    }
  }

  /**
   * Adds a static importPath property to Polymer elements.
   */
  private addImportPathsToElements(program: Program, scriptDocument: Document) {
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

      const nodePath = getNodePathInProgram(program, element.astNode);

      if (nodePath === undefined) {
        console.warn(
            new Warning({
              code: 'not-found',
              message: `Can't find recast node for element ${element.tagName}`,
              parsedDocument: this.document.parsedDocument,
              severity: Severity.WARNING,
              sourceRange: element.sourceRange!
            }).toString());
        continue;
      }

      const importMetaUrl = jsc.memberExpression(
          jsc.memberExpression(
              jsc.identifier('import'), jsc.identifier('meta')),
          jsc.identifier('url'));

      const node = nodePath.node;
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        // A Polymer 2.0 class-based element
        const getter = jsc.methodDefinition(
            'get',
            jsc.identifier('importPath'),
            jsc.functionExpression(
                null,
                [],
                jsc.blockStatement([jsc.returnStatement(importMetaUrl)])),
            true);
        node.body.body.splice(0, 0, getter);
      } else if (node.type === 'CallExpression') {
        // A Polymer hybrid/legacy factory function element
        const arg = node.arguments[0];
        if (arg && arg.type === 'ObjectExpression') {
          arg.properties.unshift(jsc.property(
              'init', jsc.identifier('importPath'), importMetaUrl));
        }
      } else {
        console.error(
            `Internal Error, Class or CallExpression expected, got ${
                                                                     node.type
                                                                   }`);
      }
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
    const namespacedExports = this.namespacedExports;
    const conversionSettings = this.conversionSettings;
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
        const isNamespace = conversionSettings.namespaces.has(memberName);
        const parentIsMemberExpression =
            (path.parent && getMemberPath(path.parent.node)) !== undefined;
        if (!isNamespace || parentIsMemberExpression) {
          return false;
        }
        const exportOfMember = namespacedExports.get(memberName);
        if (!exportOfMember) {
          return false;
        }
        // Store the imported reference
        addToImportedReferences(exportOfMember, path);
        return false;
      },
      visitMemberExpression(path: NodePath<estree.MemberExpression>) {
        const memberPath = getMemberPath(path.node);
        if (!memberPath) {
          this.traverse(path);
          return;
        }
        const memberName = memberPath.join('.');
        const assignmentPath = getPathOfAssignmentTo(path);
        if (assignmentPath) {
          const setterName = getSetterName(memberPath);
          const exportOfMember = namespacedExports.get(setterName);
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
        const exportOfMember = namespacedExports.get(memberName);
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

  private warnOnDangerousReferences(program: Program) {
    const originalUrl = this.originalUrl;
    astTypes.visit(program, {
      visitMemberExpression(path: NodePath<estree.MemberExpression>) {
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
   * Converts an HTML Document's path from old world to new. Use new NPM naming
   * as needed in the path, and change any .html extension to .js.
   */
  private convertDocumentUrl(htmlUrl: OriginalDocumentUrl):
      ConvertedDocumentUrl {
    // TODO(fks): This can be removed later if type-checking htmlUrl is enough
    if (!isOriginalDocumentUrlFormat(htmlUrl)) {
      throw new Error(
          `convertDocumentUrl() expects an OriginalDocumentUrl string` +
          `from the analyzer, but got "${htmlUrl}"`);
    }
    // Use the layout-specific UrlHandler to convert the URL.
    let jsUrl: string = this.urlHandler.convertUrl(htmlUrl);
    // Temporary workaround for imports of some shadycss files that wrapped
    // ES6 modules.
    if (jsUrl.endsWith('shadycss/apply-shim.html')) {
      jsUrl = jsUrl.replace(
          'shadycss/apply-shim.html', 'shadycss/entrypoints/apply-shim.js');
    }
    if (jsUrl.endsWith('shadycss/custom-style-interface.html')) {
      jsUrl = jsUrl.replace(
          'shadycss/custom-style-interface.html',
          'shadycss/entrypoints/custom-style-interface.js');
    }
    // Convert any ".html" URLs to point to their new ".js" module equivilent
    jsUrl = replaceHtmlExtensionIfFound(jsUrl);
    return jsUrl as ConvertedDocumentUrl;
  }

  /**
   * Converts the URL for a script that is already being loaded in a
   * pre-conversion HTML document via the <script> tag. This is similar to
   * convertDocumentUrl(), but can skip some of the more complex .html -> .js
   * conversion/rewriting.
   */
  private convertScriptUrl(oldUrl: OriginalDocumentUrl): ConvertedDocumentUrl {
    // TODO(fks): This can be removed later if type-checking htmlUrl is enough
    if (!isOriginalDocumentUrlFormat(oldUrl)) {
      throw new Error(
          `convertDocumentUrl() expects an OriginalDocumentUrl string` +
          `from the analyzer, but got "${oldUrl}"`);
    }
    // Use the layout-specific UrlHandler to convert the URL.
    return this.urlHandler.convertUrl(oldUrl);
  }

  /**
   * Format an import from the current document to the given JS URL. If an
   * original HTML import URL is given, attempt to match the format of that
   * import URL as much as possible. For example, if the original import URL was
   * an absolute path, return an absolute path as well.
   *
   * TODO(fks): Make this run on Windows/Non-Unix systems (#236)
   */
  private formatImportUrl(
      toUrl: ConvertedDocumentUrl, originalHtmlImportUrl?: string): string {
    // Return an absolute URL path if the original HTML import was absolute.
    // TODO(fks) 11-06-2017: Still return true absolute paths when using
    // bare/named imports?
    if (originalHtmlImportUrl && path.posix.isAbsolute(originalHtmlImportUrl)) {
      return '/' + toUrl.slice('./'.length);
    }
    // If the import is contained within a single package (internal), return
    // a path-based import.
    if (this.urlHandler.isImportInternal(this.convertedUrl, toUrl)) {
      return this.urlHandler.getPathImportUrl(this.convertedUrl, toUrl);
    }
    // Otherwise, return the external import URL formatted for names or paths.
    if (this.conversionSettings.npmImportStyle === 'name') {
      return this.urlHandler.getNameImportUrl(toUrl);
    } else {
      return this.urlHandler.getPathImportUrl(this.convertedUrl, toUrl);
    }
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
          this.convertDocumentUrl(getDocumentUrl(htmlImport.document));

      const references = importedReferences.get(importedJsDocumentUrl);
      const namedExports =
          new Set(IterableX.from(references || []).map((ref) => ref.target));

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
          new Set(IterableX.from(references || []).map((ref) => ref.target));
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
