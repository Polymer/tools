/**
 * @license
 * Copyright (c) 2018 The Polymer Project Authors. All rights reserved.
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
import {Program} from 'estree';
import * as jsc from 'jscodeshift';
import * as parse5 from 'parse5';
import {Document, Import, isPositionInsideRange, ParsedHtmlDocument, Severity, Warning} from 'polymer-analyzer';
import * as recast from 'recast';

import {ConversionSettings} from './conversion-settings';
import {attachCommentsToEndOfProgram, attachCommentsToFirstStatement, canDomModuleBeInlined, createDomNodeInsertStatements, filterClone, getCommentsBetween, getNodePathInProgram, insertStatementsIntoProgramBody, serializeNodeToTemplateLiteral} from './document-util';
import {ImportWithDocument, isImportWithDocument} from './import-with-document';
import {removeNamespaceInitializers} from './passes/remove-namespace-initializers';
import {removeToplevelUseStrict} from './passes/remove-toplevel-use-strict';
import {removeUnnecessaryEventListeners} from './passes/remove-unnecessary-waits';
import {removeWrappingIIFEs} from './passes/remove-wrapping-iife';
import {rewriteToplevelThis} from './passes/rewrite-toplevel-this';
import {ConvertedDocumentFilePath, ConvertedDocumentUrl, OriginalDocumentUrl} from './urls/types';
import {UrlHandler} from './urls/url-handler';
import {isOriginalDocumentUrlFormat} from './urls/util';
import {replaceHtmlExtensionIfFound} from './urls/util';

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

/**
 * An abstract superclass for our document scanner and document converters.
 */
export abstract class DocumentProcessor {
  protected readonly originalPackageName: string;
  protected readonly originalUrl: OriginalDocumentUrl;
  /**
   * N.B. that this converted url always points to .js, even if this document
   * will be converted to an HTML file.
   */
  protected readonly convertedUrl: ConvertedDocumentUrl;
  protected readonly convertedFilePath: ConvertedDocumentFilePath;
  protected readonly urlHandler: UrlHandler;
  protected readonly conversionSettings: ConversionSettings;
  protected readonly document: Document<ParsedHtmlDocument>;
  protected readonly program: Program;
  protected readonly convertedHtmlScripts: ReadonlySet<ImportWithDocument>;
  protected readonly leadingCommentsToPrepend: string[]|undefined;

  constructor(
      document: Document<ParsedHtmlDocument>, originalPackageName: string,
      urlHandler: UrlHandler, conversionSettings: ConversionSettings) {
    // The `originalPackageName` given by `PackageConverter` is sometimes
    // incorrect because it is always the name of the root package being
    // converted, even if this `DocumentConverter` is converting a file in a
    // dependency of the root package. Instead, it should be the name of the
    // package containing this document.
    this.originalPackageName = originalPackageName;
    this.conversionSettings = conversionSettings;
    this.urlHandler = urlHandler;
    this.document = document;
    this.originalUrl = urlHandler.getDocumentUrl(document);
    this.convertedUrl = this.convertDocumentUrl(this.originalUrl);
    const relativeConvertedUrl =
        this.urlHandler.convertedUrlToPackageRelative(this.convertedUrl);
    this.convertedFilePath =
        this.urlHandler.packageRelativeConvertedUrlToConvertedDocumentFilePath(
            originalPackageName, relativeConvertedUrl);
    const prepareResult = this.prepareJsModule();
    this.program = prepareResult.program;
    this.convertedHtmlScripts = prepareResult.convertedHtmlScripts;
    this.leadingCommentsToPrepend = prepareResult.leadingCommentsToPrepend;
  }

  private isInternalNonModuleImport(scriptImport: ImportWithDocument): boolean {
    const oldScriptUrl = this.urlHandler.getDocumentUrl(scriptImport.document);
    const newScriptUrl = this.convertScriptUrl(oldScriptUrl);
    const isModuleImport = scriptImport.astNode !== undefined &&
        scriptImport.astNode.language === 'html' &&
        dom5.getAttribute(scriptImport.astNode.node, 'type') === 'module';
    const isInternalImport =
        this.urlHandler.isImportInternal(this.convertedUrl, newScriptUrl);
    return isInternalImport && !isModuleImport;
  }

  /**
   * Creates a single program from all the JavaScript in the current document.
   * The standard program result can be used for either scanning or conversion.
   *
   * TODO: this does a lot of mutation of the program. Could we only do that
   *   when we're converting, and not when we're scanning?
   */
  private prepareJsModule() {
    const combinedToplevelStatements = [];
    const convertedHtmlScripts = new Set<ImportWithDocument>();
    const claimedDomModules = new Set<parse5.ASTNode>();
    let prevScriptNode: parse5.ASTNode|undefined = undefined;
    /**
     * Inserting leading comments is surprisingly tricky, because they must
     * be attached to a node, but very few nodes can come before an import,
     * and in general we don't want to insert fake nodes, so instead we
     * pass these up to be added onto the first node in the final output script.
     */
    let htmlCommentsBeforeFirstScriptNode: undefined|string[];
    for (const script of this.document.getFeatures()) {
      let scriptDocument: Document;
      if (script.kinds.has('html-script')) {
        const scriptImport = script as Import;
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

        if (!this.isInternalNonModuleImport(scriptImport)) {
          continue;
        }

        scriptDocument = scriptImport.document;
        convertedHtmlScripts.add(scriptImport);
      } else if (script.kinds.has('js-document')) {
        scriptDocument = script as Document;
      } else {
        continue;
      }
      const scriptProgram =
          recast.parse(scriptDocument.parsedDocument.contents).program;
      rewriteToplevelThis(scriptProgram);
      removeToplevelUseStrict(scriptProgram);
      // We need to inline templates on a per-script basis, otherwise we run
      // into trouble matching up analyzer AST nodes with our own.
      const localClaimedDomModules =
          this.inlineTemplates(scriptProgram, scriptDocument);
      for (const claimedDomModule of localClaimedDomModules) {
        claimedDomModules.add(claimedDomModule);
      }
      if (this.conversionSettings.addImportMeta) {
        this.addImportMetaToElements(scriptProgram, scriptDocument);
      }
      const statements = scriptProgram.body;
      if (script.astNode && script.astNode.language === 'html') {
        if (prevScriptNode !== undefined) {
          const comments: string[] = getCommentsBetween(
              this.document.parsedDocument.ast,
              prevScriptNode,
              script.astNode.node);
          attachCommentsToFirstStatement(comments, statements);
        } else {
          htmlCommentsBeforeFirstScriptNode = getCommentsBetween(
              this.document.parsedDocument.ast,
              prevScriptNode,
              script.astNode.node);
        }
        prevScriptNode = script.astNode.node;
      }

      combinedToplevelStatements.push(...statements);
    }

    const program = jsc.program(combinedToplevelStatements);
    removeUnnecessaryEventListeners(program);
    removeWrappingIIFEs(program);

    const trailingComments = getCommentsBetween(
        this.document.parsedDocument.ast, prevScriptNode, undefined);
    attachCommentsToEndOfProgram(trailingComments, combinedToplevelStatements);

    this.insertCodeToGenerateHtmlElements(program, claimedDomModules);
    removeNamespaceInitializers(program, this.conversionSettings.namespaces);

    return {
      program,
      convertedHtmlScripts,
      leadingCommentsToPrepend: htmlCommentsBeforeFirstScriptNode
    };
  }

  /**
   * Recreate the HTML contents from the original HTML document by adding
   * code to the top of program that constructs equivalent DOM and insert
   * it into `window.document`.
   */
  private insertCodeToGenerateHtmlElements(
      program: Program, claimedDomModules: Set<parse5.ASTNode>) {
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

    const genericElements = filterClone(elements, (e) => {
      return !(
          generatedElementBlacklist.has(e.tagName) || claimedDomModules.has(e));
    });
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
    const claimedDomModules = new Set<parse5.ASTNode>();

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
      claimedDomModules.add(domModule);
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
        console.error(`Internal Error, Class or CallExpression expected, got ${
            node.type}`);
      }
    }
    return claimedDomModules;
  }

  /**
   * Adds a static importMeta property to Polymer elements.
   */
  private addImportMetaToElements(program: Program, scriptDocument: Document) {
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

      const importMeta = jsc.memberExpression(
          jsc.identifier('import'), jsc.identifier('meta'));

      const node = nodePath.node;
      if (node.type === 'ClassDeclaration' || node.type === 'ClassExpression') {
        // A Polymer 2.0 class-based element
        const getter = jsc.methodDefinition(
            'get',
            jsc.identifier('importMeta'),
            jsc.functionExpression(
                null,
                [],
                jsc.blockStatement([jsc.returnStatement(importMeta)])),
            true);
        node.body.body.splice(0, 0, getter);
      } else if (node.type === 'CallExpression') {
        // A Polymer hybrid/legacy factory function element
        const arg = node.arguments[0];
        if (arg && arg.type === 'ObjectExpression') {
          arg.properties.unshift(
              jsc.property('init', jsc.identifier('importMeta'), importMeta));
        }
      } else {
        console.error(`Internal Error, Class or CallExpression expected, got ${
            node.type}`);
      }
    }
  }



  /**
   * Converts an HTML Document's path from old world to new. Use new NPM naming
   * as needed in the path, and change any .html extension to .js.
   */
  protected convertDocumentUrl(htmlUrl: OriginalDocumentUrl):
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

    // This is a special case for renaming 'polymer.html' in Polymer to
    // 'polymer-legacy.html'.
    if (this.originalPackageName === 'polymer' && jsUrl === './polymer.html') {
      // We're converting 'polymer.html' itself:
      jsUrl = './polymer-legacy.html';
    } else if (jsUrl.endsWith('polymer/polymer.html')) {
      // We're converting something that references 'polymer.html':
      jsUrl = jsUrl.replace(
          /polymer\/polymer\.html$/, 'polymer/polymer-legacy.html');
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
  protected convertScriptUrl(oldUrl: OriginalDocumentUrl):
      ConvertedDocumentUrl {
    // TODO(fks): This can be removed later if type-checking htmlUrl is enough
    if (!isOriginalDocumentUrlFormat(oldUrl)) {
      throw new Error(
          `convertDocumentUrl() expects an OriginalDocumentUrl string` +
          `from the analyzer, but got "${oldUrl}"`);
    }
    // Use the layout-specific UrlHandler to convert the URL.
    return this.urlHandler.convertUrl(oldUrl);
  }
}
