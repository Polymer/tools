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

import * as espree from 'espree';
import * as estree from 'estree';

import {correctSourceRange, InlineDocInfo, LocationOffset, Severity, SourceRange, Warning, WarningCarryingException} from '../model/model';
import {Parser} from '../parser/parser';

import {JavaScriptDocument} from './javascript-document';

declare class SyntaxError {
  message: string;
  lineNumber: number;
  column: number;
}

// TODO(rictic): stop exporting this.
export const baseParseOptions = {
  ecmaVersion: 8,
  attachComment: true,
  comment: true,
  loc: true,
};

export class JavaScriptParser implements Parser<JavaScriptDocument> {
  parse(contents: string, url: string, inlineInfo?: InlineDocInfo<any>):
      JavaScriptDocument {
    const isInline = !!inlineInfo;
    inlineInfo = inlineInfo || {};
    const result = parseJs(contents, url, inlineInfo.locationOffset);
    if (result.type === 'failure') {
      // TODO(rictic): define and return a ParseResult instead of throwing.
      const minimalDocument = new JavaScriptDocument({
        url,
        contents,
        ast: null as any,
        locationOffset: inlineInfo.locationOffset,
        astNode: inlineInfo.astNode,
        isInline,
        parsedAsSourceType: 'script',
      });
      throw new WarningCarryingException(
          new Warning({parsedDocument: minimalDocument, ...result.warning}));
    }

    return new JavaScriptDocument({
      url,
      contents,
      ast: result.program,
      locationOffset: inlineInfo.locationOffset,
      astNode: inlineInfo.astNode,
      isInline,
      parsedAsSourceType: result.sourceType,
    });
  }
}


export type ParseResult = {
  type: 'success',
  sourceType: 'script'|'module',
  program: estree.Program
}|{
  type: 'failure',
  warning: {
    sourceRange: SourceRange,
    severity: Severity,
    code: string,
    message: string
  }
};

/**
 * Parse the given contents and return either an AST or a parse error as a
 * Warning.
 *
 * It needs the filename and the location offset to produce correct warnings.
 */
export function parseJs(
    contents: string,
    file: string,
    locationOffset?: LocationOffset,
    warningCode?: string): ParseResult {
  if (!warningCode) {
    warningCode = 'parse-error';
  }
  const options = Object.assign(
      {sourceType: 'script' as ('script' | 'module')}, baseParseOptions);
  try {
    return {
      type: 'success',
      sourceType: 'script',
      program: espree.parse(contents, options)
    };
  } catch (_ignored) {
    try {
      options.sourceType = 'module';
      return {
        type: 'success',
        sourceType: 'module',
        program: espree.parse(contents, options)
      };
    } catch (err) {
      if (err instanceof SyntaxError) {
        return {
          type: 'failure',
          warning: {
            message: err.message.split('\n')[0],
            severity: Severity.ERROR,
            code: warningCode,
            sourceRange: correctSourceRange(
                {
                  file,
                  start: {line: err.lineNumber - 1, column: err.column - 1},
                  end: {line: err.lineNumber - 1, column: err.column - 1}
                },
                locationOffset)!
          }
        };
      }
      throw err;
    }
  }
}
