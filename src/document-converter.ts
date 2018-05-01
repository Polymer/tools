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
import {EOL} from 'os';
import * as parse5 from 'parse5';
import * as path from 'path';
import {Document, Import, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';
import * as recast from 'recast';

import {DocumentProcessor} from './document-processor';
import {attachCommentsToFirstStatement, collectIdentifierNames, containsWriteToGlobalSettingsObject, createDomNodeInsertStatements, findAvailableIdentifier, getMemberPath, getPathOfAssignmentTo, getSetterName, serializeNode} from './document-util';
import {ImportWithDocument, isImportWithDocument} from './import-with-document';
import {ConversionResult, JsExport} from './js-module';
import {addA11ySuiteIfUsed} from './passes/add-a11y-suite-if-used';
import {removeToplevelUseStrict} from './passes/remove-toplevel-use-strict';
import {removeUnnecessaryEventListeners} from './passes/remove-unnecessary-waits';
import {removeWrappingIIFEs} from './passes/remove-wrapping-iife';
import {rewriteExcludedReferences} from './passes/rewrite-excluded-references';
import {rewriteNamespacesAsExports} from './passes/rewrite-namespace-exports';
import {rewriteNamespacesThisReferences} from './passes/rewrite-namespace-this-references';
import {rewriteReferencesToLocalExports} from './passes/rewrite-references-to-local-exports';
import {rewriteReferencesToNamespaceMembers} from './passes/rewrite-references-to-namespace-members';
import {rewriteToplevelThis} from './passes/rewrite-toplevel-this';
import {ConvertedDocumentUrl} from './urls/types';
import {getHtmlDocumentConvertedFilePath, getJsModuleConvertedFilePath, getModuleId, getScriptConvertedFilePath} from './urls/util';

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
 * This is a set of JavaScript files that we know to be converted as modules.
 * This is neccessary because we don't definitively know the converted type
 * of an external JavaScript file loaded as a normal script in
 * a top-level HTML file.
 *
 * TODO(fks): Add the ability to know via conversion manifest support or
 * convert dependencies as entire packages instead of file-by-file.
 * (See https://github.com/Polymer/polymer-modulizer/issues/268)
 */
const knownScriptModules = new Set<string>([
  'iron-test-helpers/mock-interactions.js',
  'iron-test-helpers/test-helpers.js',
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
export class DocumentConverter extends DocumentProcessor {
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
  private getHtmlImports(): Array<ImportWithDocument> {
    const filteredImports = [];
    for (const import_ of DocumentConverter.getAllHtmlImports(this.document)) {
      if (!isImportWithDocument(import_)) {
        console.warn(
            new Warning({
              code: 'import-ignored',
              message: `Import could not be loaded and will be ignored.`,
              parsedDocument: this.document.parsedDocument,
              severity: Severity.WARNING,
              sourceRange: import_.sourceRange!,
            }).toString());
        continue;
      }

      const documentUrl = this.urlHandler.getDocumentUrl(import_.document);
      if (this.conversionSettings.excludes.has(documentUrl)) {
        continue;
      }

      filteredImports.push(import_);
    }
    return filteredImports;
  }

  /**
   * Convert a document to a JS Module.
   */
  convertJsModule(namespacedExports: Map<string, JsExport>):
      ConversionResult[] {
    const importedReferences =
        this.collectNamespacedReferences(this.program, namespacedExports);
    const results: ConversionResult[] = [];

    // Add imports for every non-module <script> tag to just import the file
    // itself.
    for (const scriptImport of this.document.getFeatures(
             {kind: 'html-script'})) {
      if (!isImportWithDocument(scriptImport)) {
        console.warn(
            new Warning({
              code: 'import-ignored',
              message: `Import could not be loaded and will be ignored.`,
              parsedDocument: this.document.parsedDocument,
              severity: Severity.WARNING,
              sourceRange: scriptImport.sourceRange!,
            }).toString());
        continue;
      }

      const oldScriptUrl =
          this.urlHandler.getDocumentUrl(scriptImport.document);
      const newScriptUrl = this.convertScriptUrl(oldScriptUrl);
      if (this.convertedHtmlScripts.has(scriptImport)) {
        // NOTE: This deleted script file path *may* === this document's final
        // converted file path. Because results are written in order, the
        // final result (this document) has the final say, and any previous
        // deletions won't overwrite/conflict with the final document.
        results.push({
          originalUrl: oldScriptUrl,
          convertedUrl: newScriptUrl,
          convertedFilePath: getScriptConvertedFilePath(oldScriptUrl),
          deleteOriginal: true,
          output: undefined,
        });
      } else {
        importedReferences.set(newScriptUrl, new Set());
      }
    }

    this.addJsImports(this.program, importedReferences);
    const {localNamespaceNames, namespaceNames, exportMigrationRecords} =
        rewriteNamespacesAsExports(
            this.program, this.document, this.conversionSettings.namespaces);
    const allNamespaceNames =
        new Set([...localNamespaceNames, ...namespaceNames]);
    rewriteNamespacesThisReferences(this.program, namespaceNames);
    rewriteExcludedReferences(this.program, this.conversionSettings);
    rewriteReferencesToLocalExports(this.program, exportMigrationRecords);
    rewriteReferencesToNamespaceMembers(this.program, allNamespaceNames);
    this.warnOnDangerousReferences(this.program);

    // Attach any leading comments to the first statement.
    if (this.leadingCommentsToPrepend !== undefined) {
      attachCommentsToFirstStatement(
          this.leadingCommentsToPrepend, this.program.body);
    }

    const outputProgram = recast.print(
        this.program, {quote: 'single', wrapColumn: 80, tabWidth: 2});

    results.push({
      originalUrl: this.originalUrl,
      convertedUrl: this.convertedUrl,
      convertedFilePath: getJsModuleConvertedFilePath(this.convertedFilePath),
      deleteOriginal: true,
      output: outputProgram.code + EOL
    });
    return results;
  }

  /**
   * Convert a document to a top-level HTML document.
   */
  convertTopLevelHtmlDocument(namespacedExports: Map<string, JsExport>):
      ConversionResult {
    const htmlDocument = this.document.parsedDocument as ParsedHtmlDocument;
    const p = dom5.predicates;

    const edits: Array<Edit> = [];
    for (const script of this.document.getFeatures({kind: 'js-document'})) {
      if (!script.astNode ||
          !isLegacyJavaScriptTag(script.astNode.node as parse5.ASTNode)) {
        continue;  // ignore unknown script tags and preexisting modules
      }
      const astNode = script.astNode.node as parse5.ASTNode;
      const sourceRange =
          script.astNode ? htmlDocument.sourceRangeForNode(astNode) : undefined;
      if (!sourceRange) {
        continue;  // nothing we can do about scripts without known positions
      }
      const offsets = htmlDocument.sourceRangeToOffsets(sourceRange);

      const file = recast.parse(script.parsedDocument.contents);
      const program = this.rewriteInlineScript(file.program, namespacedExports);

      if (program === undefined) {
        continue;
      }

      const newScriptTag =
          parse5.treeAdapters.default.createElement('script', '', []);
      dom5.setAttribute(newScriptTag, 'type', 'module');
      dom5.setTextContent(
          newScriptTag,
          EOL +
              recast
                  .print(
                      program, {quote: 'single', wrapColumn: 80, tabWidth: 2})
                  .code +
              EOL);
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
      const program = this.rewriteInlineScript(file.program, namespacedExports);

      if (program === undefined) {
        continue;
      }

      const newScriptTag =
          parse5.treeAdapters.default.createElement('script', '', []);
      dom5.setAttribute(newScriptTag, 'type', 'module');
      dom5.setTextContent(
          newScriptTag,
          EOL +
              recast
                  .print(
                      program, {quote: 'single', wrapColumn: 80, tabWidth: 2})
                  .code +
              EOL);
      const replacementText = serializeNode(newScriptTag);
      edits.push({offsets, replacementText});
    }

    for (const htmlImport of this.getHtmlImports()) {
      // Only replace imports that are actually in the document.
      if (!htmlImport.sourceRange) {
        continue;
      }
      const offsets = htmlDocument.sourceRangeToOffsets(htmlImport.sourceRange);

      const htmlDocumentUrl =
          this.urlHandler.getDocumentUrl(htmlImport.document);
      const importedJsDocumentUrl = this.convertDocumentUrl(htmlDocumentUrl);
      const importUrl = this.formatImportUrl(
          importedJsDocumentUrl, htmlImport.originalUrl, true);
      const scriptTag = parse5.parseFragment(`<script type="module"></script>`)
                            .childNodes![0];
      dom5.setAttribute(scriptTag, 'src', importUrl);
      const replacementText = serializeNode(scriptTag);
      edits.push({offsets, replacementText});
    }

    for (const scriptImport of this.document.getFeatures(
             {kind: 'html-script'})) {
      if (!isImportWithDocument(scriptImport)) {
        console.warn(
            new Warning({
              code: 'import-ignored',
              message: `Import could not be loaded and will be ignored.`,
              parsedDocument: this.document.parsedDocument,
              severity: Severity.WARNING,
              sourceRange: scriptImport.sourceRange!,
            }).toString());
        continue;
      }

      // ignore fake script imports injected by various hacks in the
      // analyzer
      if (scriptImport.sourceRange === undefined ||
          scriptImport.astNode === undefined ||
          scriptImport.astNode.language !== 'html') {
        continue;
      }
      if (!dom5.predicates.hasTagName('script')(scriptImport.astNode.node)) {
        throw new Error(
            `Expected an 'html-script' kinded feature to ` +
            `have a script tag for an AST node.`);
      }
      const offsets = htmlDocument.sourceRangeToOffsets(
          htmlDocument.sourceRangeForNode(scriptImport.astNode.node)!);

      const convertedUrl = this.convertDocumentUrl(
          this.urlHandler.getDocumentUrl(scriptImport.document));
      const formattedUrl =
          this.formatImportUrl(convertedUrl, scriptImport.originalUrl, true);
      dom5.setAttribute(scriptImport.astNode.node, 'src', formattedUrl);

      // Temporary: Check if imported script is a known module.
      // See `knownScriptModules` for more information.
      for (const importUrlEnding of knownScriptModules) {
        if (scriptImport.url.endsWith(importUrlEnding)) {
          dom5.setAttribute(scriptImport.astNode.node, 'type', 'module');
        }
      }

      edits.push(
          {offsets, replacementText: serializeNode(scriptImport.astNode.node)});
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
      convertedFilePath:
          getHtmlDocumentConvertedFilePath(this.convertedFilePath),
      output: contents
    };
  }

  /**
   * Create a ConversionResult object to delete the file instead of converting
   * it.
   */
  createDeleteResult(): ConversionResult {
    return {
      originalUrl: this.originalUrl,
      convertedUrl: this.convertedUrl,
      convertedFilePath: getJsModuleConvertedFilePath(this.convertedFilePath),
      deleteOriginal: true,
      output: undefined,
    };
  }

  /**
   * Rewrite an inline script that will exist inlined inside an HTML document.
   * Should not be called on top-level JS Modules.
   */
  private rewriteInlineScript(
      program: Program, namespacedExports: Map<string, JsExport>) {
    // Any code that sets the global settings object cannot be inlined (and
    // deferred) because the settings object must be created/configured
    // before other imports evaluate in following module scripts.
    if (containsWriteToGlobalSettingsObject(program)) {
      return undefined;
    }

    rewriteToplevelThis(program);
    removeToplevelUseStrict(program);
    removeUnnecessaryEventListeners(program);
    removeWrappingIIFEs(program);
    const importedReferences =
        this.collectNamespacedReferences(program, namespacedExports);
    const wasA11ySuiteAdded = addA11ySuiteIfUsed(
        program,
        this.formatImportUrl(this.urlHandler.createConvertedUrl(
            'wct-browser-legacy/a11ySuite.js')));
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

    if (!wasA11ySuiteAdded && !wereImportsAdded) {
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
    `.split('\n').join(EOL);
    let first = true;
    for (const tag of tagsToInsertImperatively) {
      const offsets = htmlDocument.sourceRangeToOffsets(
          htmlDocument.sourceRangeForNode(tag)!);
      const scriptTag = parse5.parseFragment(`<script type="module"></script>`)
                            .childNodes![0];
      const program = jsc.program(createDomNodeInsertStatements([tag]));
      dom5.setTextContent(
          scriptTag,
          EOL +
              recast
                  .print(
                      program, {quote: 'single', wrapColumn: 80, tabWidth: 2})
                  .code +
              EOL);
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
          EOL +
              recast
                  .print(
                      program, {quote: 'single', wrapColumn: 80, tabWidth: 2})
                  .code +
              EOL);
      let replacementText = serializeNode(scriptTag);
      if (first) {
        replacementText = apology + replacementText;
        first = false;
      }
      yield {offsets, replacementText};
    }
  }

  /**
   * Rewrite namespaced references to the imported name. e.g. changes
   * Polymer.Element -> $Element
   *
   * Returns a map of from url to identifier of the references we should
   * import.
   */
  private collectNamespacedReferences(
      program: Program, namespacedExports: Map<string, JsExport>):
      Map<ConvertedDocumentUrl, Set<ImportReference>> {
    const convertedUrl = this.convertedUrl;
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
        if (!exportOfMember || exportOfMember.url === convertedUrl) {
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
          if (!exportOfMember || exportOfMember.url === convertedUrl) {
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
        if (!exportOfMember || exportOfMember.url === convertedUrl) {
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
   * Checks if a path points to webcomponents-lite.js and will change it to
   * webcomponents-bundle.js if it does.
   *
   * @param filePath path to transform.
   */
  private webcomponentsLiteToBundle(filePath: string) {
    const pathObject = path.posix.parse(filePath);

    if (pathObject.base === 'webcomponents-lite.js') {
      pathObject.base = 'webcomponents-bundle.js';
    }

    return path.posix.format(pathObject);
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
      toUrl: ConvertedDocumentUrl, originalHtmlImportUrl?: string,
      forcePath = false): string {
    // Return an absolute URL path if the original HTML import was absolute.
    // TODO(fks) 11-06-2017: Still return true absolute paths when using
    // bare/named imports?
    if (originalHtmlImportUrl && path.posix.isAbsolute(originalHtmlImportUrl)) {
      const formattedUrl = '/' + toUrl.slice('./'.length);
      return this.webcomponentsLiteToBundle(formattedUrl);
    }
    // If the import is contained within a single package (internal), return
    // a path-based import.
    if (this.urlHandler.isImportInternal(this.convertedUrl, toUrl)) {
      return this.urlHandler.getPathImportUrl(this.convertedUrl, toUrl);
    }
    // Otherwise, return the external import URL formatted for names or paths.
    if (forcePath || this.conversionSettings.npmImportStyle === 'path') {
      const formattedUrl =
          this.urlHandler.getPathImportUrl(this.convertedUrl, toUrl);
      return this.webcomponentsLiteToBundle(formattedUrl);
    } else {
      const formattedUrl = this.urlHandler.getNameImportUrl(toUrl);
      return this.webcomponentsLiteToBundle(formattedUrl);
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
      const importedJsDocumentUrl = this.convertDocumentUrl(
          this.urlHandler.getDocumentUrl(htmlImport.document));

      const references = importedReferences.get(importedJsDocumentUrl);
      const namedExports =
          new Set(IterableX.from(references || []).map((ref) => ref.target));

      const jsFormattedImportUrl =
          this.formatImportUrl(importedJsDocumentUrl, htmlImport.originalUrl);
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
