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

import {Severity, WarningCarryingException} from '../editor-service/editor-service';
import {Parser} from '../parser/parser';

import {JavaScriptDocument} from './javascript-document';

declare class SyntaxError {
  message: string;
  lineNumber: number;
  column: number;
}

export class JavaScriptParser implements Parser<JavaScriptDocument> {
  sourceType: 'module'|'script';

  constructor(options: {sourceType: 'module' | 'script'}) {
    console.assert(options != null);
    console.assert(options.sourceType != null);
    this.sourceType = options.sourceType;
  }

  parse(contents: string, url: string): JavaScriptDocument {
    let ast: Program;
    try {
      ast = <Program>espree.parse(contents, {
        ecmaVersion: 7,
        attachComment: true,
        comment: true,
        loc: true,
        sourceType: this.sourceType,
      });
    } catch (err) {
      if (err instanceof SyntaxError) {
        throw new WarningCarryingException({
          message: err.message.split('\n')[0],
          severity: Severity.ERROR,
          code: 'parse-error',
          sourceRange: {
            file: url,
            start: {line: err.lineNumber - 1, column: err.column - 1},
            end: {line: err.lineNumber - 1, column: err.column - 1}
          }
        });
      }
      throw err;
    }

    return new JavaScriptDocument({url, contents, ast});
  }
}
