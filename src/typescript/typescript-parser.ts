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

import * as ts from 'typescript';

import {Analyzer} from '../analyzer';
import {Parser} from '../parser/parser';

import {ParsedTypeScriptDocument} from './typescript-document';

const _compilerOptions: ts.CompilerOptions = {
  allowJs: true,
};

export class TypeScriptParser implements Parser<ParsedTypeScriptDocument> {
  private _analyzer: Analyzer;

  constructor(analyzer: Analyzer) {
    this._analyzer = analyzer;
  }

  parse(contents: string, url: string): ParsedTypeScriptDocument {
    const host = new AnalyzerCompilerHost(
        this._analyzer, new Map([[url, contents], ['lib.ts', '']]));
    const program = ts.createProgram([url], _compilerOptions, host);
    return new ParsedTypeScriptDocument({
      url,
      contents,
      program,
      locationOffset: undefined,
      // TODO(justinfagnani): Fix or remove generics on ParsedDocument that
      // make this 1) necessary 2) possible (not throwing)
      ast: null as any as ts.Node,
      astNode: null,
      isInline: false,
    });
  }
}

/**
 * A TypeScript CompilerHost that only supports a single file, so that we can
 * find imports in TypeScript files before we have loaded a whole program.
 */
class AnalyzerCompilerHost implements ts.CompilerHost {
  private _analyzer: Analyzer;
  files: Map<string, string>;

  constructor(analyzer: Analyzer, files: Map<string, string>) {
    this._analyzer = analyzer;
    this.files = files;
  }

  getSourceFile(
      fileName: string, languageVersion: ts.ScriptTarget,
      onError?: (message: string) => void): ts.SourceFile {
    const resolvedUrl = this._analyzer.resolveUrl(fileName);
    const source = this.files.get(resolvedUrl);

    if (source) {
      return ts.createSourceFile(fileName, source, languageVersion);
    }
    if (onError) {
      onError('not found');
    }
    return null as any as ts.SourceFile;
  }

  getDefaultLibFileName() {
    // This is a fake name, because without a lib name with an extension
    // the compiler tries several other names
    return 'lib.ts';
  }

  get writeFile(): ts.WriteFileCallback {
    return (_fileName: string,
            _data: string,
            _writeByteOrderMark: boolean,
            _onError?: (message: string) => void,
            _sourceFiles?: ts.SourceFile[]): void => {
      // TODO(justinfagnani): figure out how to get the compiler to not call
      // this function
      // throw new Error('unsupported operation');
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

  getCanonicalFileName(fileName: string) {
    return this._analyzer.resolveUrl(fileName);
  }

  getNewLine() {
    return ts.sys.newLine;
  }

  useCaseSensitiveFileNames() {
    return true;
  }

  fileExists(fileName: string) {
    const resolvedUrl = this._analyzer.resolveUrl(fileName);
    return this.files.has(resolvedUrl);
  }

  readFile(fileName: string): string {
    const resolvedUrl = this._analyzer.resolveUrl(fileName);
    return this.files.get(resolvedUrl)!;
  }

  resolveModuleNames(moduleNames: string[], _containingFile: string):
      ts.ResolvedModule[] {
    // Since in the pre-scanner we only want single-file compilation, we don't
    // resolve any modules.
    return moduleNames.map((_moduleName) => null as any as ts.ResolvedModule);

    // TODO(justinfagani): the following is what we do when we actually
    // want multi-file compilation. Move to a post-link compiler host.
    // return moduleNames.map(moduleName => {
    //   // We only support path resolution, not node resolution
    //   if (!(moduleName.startsWith('./') || moduleName.startsWith('../') ||
    //   moduleName.startsWith('/'))) {
    //     console.log(`unsupported module specifier ${moduleName}`);
    //     return { resolvedFileName: null as any as string };
    //   }
    //   // since we have a path, we cn simply resolve it
    //   const fileName = path.resolve(containingFile, moduleName);
    //   const resolvedFileName = this._analyzer.resolveUrl(fileName);
    //   return { resolvedFileName };
    // });
  }
}
