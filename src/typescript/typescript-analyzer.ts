/**
 * @license
 * Copyright (c) 2016 The Polymer Project Authors. All rights reserved.
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

import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

import {AnalysisContext} from '../core/analysis-context';
import {LanguageAnalyzer} from '../core/language-analyzer';
import {PackageRelativeUrl} from '../model/url';

import {ParsedTypeScriptDocument} from './typescript-document';

const _compilerOptions: ts.CompilerOptions = {
  allowJs: true,
  emit: false,
  lib: ['ES2017', 'DOM'],
};

export class TypeScriptAnalyzer implements LanguageAnalyzer<ts.Program> {
  private _context: AnalysisContext;

  constructor(analysisContext: AnalysisContext) {
    this._context = analysisContext;
  }

  analyze(url: string): ts.Program {
    const host = new AnalyzerCompilerHost(this._context);
    return ts.createProgram([url], _compilerOptions, host);
  }
}

// This is mainly for telling the compiler the directory that the
// lib files are in.
const defaultLib = '/$lib/lib.es2017.d.ts';

const tsLibPath = path.dirname(require.resolve('typescript'));

function isLibraryPath(filename: string) {
  return filename.startsWith('/$lib/');
}

const libraryCache = new Map<string, string|undefined>();
function getLibrarySource(filePath: string) {
  if (libraryCache.has(filePath)) {
    return libraryCache.get(filePath);
  }
  let libFileName = filePath.substring('/$lib/'.length).toLowerCase();
  if (!libFileName.startsWith('lib.')) {
    libFileName = `lib.${libFileName}`;
  }
  const libPath = path.resolve(tsLibPath, libFileName);
  let source;
  try {
    source = fs.readFileSync(libPath, {encoding: 'utf-8'});
  } catch (e) {
    // not found
  }
  libraryCache.set(filePath, source);
  return source;
}

/**
 * A TypeScript CompilerHost that reads files from an AnalysisContext.
 */
class AnalyzerCompilerHost implements ts.CompilerHost {
  context: AnalysisContext;

  constructor(context: AnalysisContext) {
    this.context = context;
  }

  getSourceFile(
      fileName: PackageRelativeUrl, languageVersion: ts.ScriptTarget,
      onError?: (message: string) => void): ts.SourceFile {
    if (isLibraryPath(fileName)) {
      const libSource = getLibrarySource(fileName);
      if (libSource != null) {
        return ts.createSourceFile(fileName, libSource, languageVersion);
      }
      // We don't call onError for library paths because the compiler asks for
      // many paths speculatively. Returning null is sufficient.
    } else {
      // This method will be called during analysis, but after all files
      // in the dependency graph have been loaded, so it can call a synchronous
      // method to get the source of a file.
      const scannedDocument =
          this.context._getScannedDocument(this.context.resolveUrl(fileName));
      if (scannedDocument != null) {
        const typescriptDocument =
            scannedDocument.document as ParsedTypeScriptDocument;
        return typescriptDocument.ast as ts.SourceFile;
      }
      if (onError) {
        onError('not found');
      }
    }
    return null as any as ts.SourceFile;
  }

  getDefaultLibFileName() {
    return defaultLib;
  }

  get writeFile(): ts.WriteFileCallback {
    return (_fileName: string,
            _data: string,
            _writeByteOrderMark: boolean,
            _onError?: (message: string) => void,
            _sourceFiles?: ReadonlyArray<ts.SourceFile>): void => {
      throw new Error('unsupported operation');
    };
  }

  getCurrentDirectory() {
    // Seems to work best
    return '';
  }

  getDirectories(_path: string): string[] {
    // Seems to work best
    return [''];
  }

  getCanonicalFileName(fileName: PackageRelativeUrl) {
    return this.context.resolveUrl(fileName);
  }

  getNewLine() {
    return ts.sys.newLine;
  }

  useCaseSensitiveFileNames() {
    return true;
  }

  fileExists(fileName: PackageRelativeUrl) {
    const resolvedUrl = this.context.resolveUrl(fileName);
    return isLibraryPath(resolvedUrl) &&
        getLibrarySource(resolvedUrl) != null ||
        this.context._getScannedDocument(resolvedUrl) != null;
  }

  readFile(fileName: PackageRelativeUrl): string {
    const resolvedUrl = this.context.resolveUrl(fileName);
    if (isLibraryPath(resolvedUrl)) {
      const libPath = require.resolve(`typescript/lib/${fileName}`);
      return fs.readFileSync(libPath, {encoding: 'utf-8'});
    }
    const document = this.context._getScannedDocument(resolvedUrl);
    return (document) ? document.document.contents : null as any as string;
  }

  resolveModuleNames(moduleNames: string[], containingFile: string):
      ts.ResolvedModule[] {
    return moduleNames.map((moduleName) => {
      // We only support path resolution, not node resolution
      if (!(moduleName.startsWith('./') || moduleName.startsWith('../') ||
            moduleName.startsWith('/'))) {
        return {resolvedFileName: null as any as string};
      }
      // since we have a path, we can simply resolve it
      const fileName = path.resolve(path.dirname(containingFile), moduleName) as
          PackageRelativeUrl;
      const resolvedFileName = this.context.resolveUrl(fileName);
      return {resolvedFileName};
    });
  }
}
