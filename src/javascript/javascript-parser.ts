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
import {Program} from 'estree';

import {correctSourceRange, InlineDocInfo} from '../model/model';
import {Parser} from '../parser/parser';
import {Severity, WarningCarryingException} from '../warning/warning';

import {JavaScriptDocument} from './javascript-document';

declare class SyntaxError {
  message: string;
  lineNumber: number;
  column: number;
}

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
    let ast: Program;
    const options = Object.assign(
        {sourceType: 'script' as ('script' | 'module')}, baseParseOptions);

    try {
      ast = <Program>espree.parse(contents, options);
    } catch (_ignored) {
      try {
        options.sourceType = 'module';
        ast = <Program>espree.parse(contents, options);
      } catch (err) {
        if (err instanceof SyntaxError) {
          throw new WarningCarryingException({
            message: err.message.split('\n')[0],
            severity: Severity.ERROR,
            code: 'parse-error',
            sourceRange: correctSourceRange(
                {
                  file: url,
                  start: {line: err.lineNumber - 1, column: err.column - 1},
                  end: {line: err.lineNumber - 1, column: err.column - 1}
                },
                inlineInfo.locationOffset)!
          });
        }
        throw err;
      }
    }

    return new JavaScriptDocument({
      url,
      contents,
      ast,
      locationOffset: inlineInfo.locationOffset,
      astNode: inlineInfo.astNode, isInline,
      parsedAsSourceType: options.sourceType,
    });
  }
}
