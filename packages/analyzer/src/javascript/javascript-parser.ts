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

import * as babel from '@babel/types';
import * as babylon from 'babylon';

import {correctSourceRange, InlineDocInfo, LocationOffset, Severity, SourceRange, Warning, WarningCarryingException} from '../model/model';
import {ResolvedUrl} from '../model/url';
import {Parser} from '../parser/parser';
import {UrlResolver} from '../url-loader/url-resolver';

import {JavaScriptDocument} from './javascript-document';

export type SourceType = 'script'|'module';

declare class SyntaxError {
  message: string;
  lineNumber: number;
  column: number;
}

const baseParseOptions: babylon.BabylonOptions = {
  plugins: [
    'asyncGenerators',
    'dynamicImport',
    'importMeta' as any,
    'objectRestSpread',
  ],
};

// TODO(usergenic): Move this to regular baseParseOptions declaration once
// @types/babylon has been updated to include `ranges`.
(baseParseOptions as any)['ranges'] = true;

export class JavaScriptParser implements Parser<JavaScriptDocument> {
  readonly sourceType?: SourceType;

  parse(
      contents: string, url: ResolvedUrl, _urlResolver: UrlResolver,
      inlineInfo?: InlineDocInfo): JavaScriptDocument {
    const isInline = !!inlineInfo;
    inlineInfo = inlineInfo || {};
    const result = parseJs(
        contents, url, inlineInfo.locationOffset, undefined, this.sourceType);
    if (result.type === 'failure') {
      // TODO(rictic): define and return a ParseResult instead of throwing.
      const minimalDocument = new JavaScriptDocument({
        url,
        contents,
        baseUrl: inlineInfo.baseUrl,
        ast: null as any,
        locationOffset: inlineInfo.locationOffset,
        astNode: inlineInfo.astNode,
        isInline,
        parsedAsSourceType: 'script',
      });
      throw new WarningCarryingException(
          new Warning({parsedDocument: minimalDocument, ...result.warningish}));
    }

    return new JavaScriptDocument({
      url,
      contents,
      baseUrl: inlineInfo.baseUrl,
      ast: result.parsedFile,
      locationOffset: inlineInfo.locationOffset,
      astNode: inlineInfo.astNode,
      isInline,
      parsedAsSourceType: result.sourceType,
    });
  }
}

export class JavaScriptModuleParser extends JavaScriptParser {
  readonly sourceType: SourceType = 'module';
}

export class JavaScriptScriptParser extends JavaScriptParser {
  readonly sourceType: SourceType = 'script';
}

export type ParseResult = {
  type: 'success',
  sourceType: SourceType,
  parsedFile: babel.File,
}|{
  type: 'failure',
  warningish: {
    sourceRange: SourceRange,
    severity: Severity,
    code: string,
    message: string,
  }
};

/**
 * Parse the given contents and return either an AST or a parse error as a
 * Warning. It needs the filename and the location offset to produce correct
 * warnings.
 */
export function parseJs(
    contents: string,
    file: ResolvedUrl,
    locationOffset?: LocationOffset,
    warningCode?: string,
    sourceType?: SourceType): ParseResult {
  if (!warningCode) {
    warningCode = 'parse-error';
  }

  let parsedFile: babel.File;
  const parseOptions = {sourceFilename: file, ...baseParseOptions};

  try {
    // If sourceType is not provided, we will try script first and if that
    // fails, we will try module, since failure is probably that it can't
    // parse the 'import' or 'export' syntax as a script.
    if (!sourceType) {
      try {
        sourceType = 'script';
        parsedFile = babylon.parse(contents, {sourceType, ...parseOptions});
      } catch (_ignored) {
        sourceType = 'module';
        parsedFile = babylon.parse(contents, {sourceType, ...parseOptions});
      }
    } else {
      parsedFile = babylon.parse(contents, {sourceType, ...parseOptions});
    }
    return {
      type: 'success',
      sourceType: sourceType,
      parsedFile,
    };
  } catch (err) {
    if (err instanceof SyntaxError) {
      updateLineNumberAndColumnForError(err);
      return {
        type: 'failure',
        warningish: {
          message: err.message.split('\n')[0],
          severity: Severity.ERROR,
          code: warningCode,
          sourceRange: correctSourceRange(
              {
                file,
                start: {line: err.lineNumber - 1, column: err.column - 1},
                end: {line: err.lineNumber - 1, column: err.column - 1}
              },
              locationOffset)!,
        }
      };
    }
    throw err;
  }
}

/**
 * Babylon does not provide lineNumber and column values for unexpected token
 * syntax errors.  This function parses the `(line:column)` value from the
 * message of these errors and updates the error object in place.
 */
function updateLineNumberAndColumnForError(err: SyntaxError) {
  if (typeof err.lineNumber === 'number' && typeof err.column === 'number') {
    return;
  }
  if (!err.message) {
    return;
  }
  const lineAndColumnMatch =
      err.message.match(/(Unexpected token.*)\(([0-9]+):([0-9]+)\)/);
  if (!lineAndColumnMatch) {
    return;
  }
  err.lineNumber = parseInt(lineAndColumnMatch[2], 10);
  err.column = parseInt(lineAndColumnMatch[3], 10) + 1;
}
