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

import * as chalk from 'chalk';

import {ParsedDocument} from '../parser/document';
import {underlineCode} from '../warning/code-printer';

import {SourceRange} from './source-range';

export interface WarningInit {
  readonly message: string;
  readonly sourceRange: SourceRange;
  readonly severity: Severity;
  readonly code: string;
  readonly parsedDocument: ParsedDocument;
}
export class Warning {
  readonly code: string;
  readonly message: string;
  readonly sourceRange: SourceRange;
  readonly severity: Severity;

  private readonly _parsedDocument: ParsedDocument;

  constructor(init: WarningInit) {
    ({
      message: this.message,
      sourceRange: this.sourceRange,
      severity: this.severity,
      code: this.code,
      parsedDocument: this._parsedDocument,
    } = init);

    if (!this.sourceRange) {
      throw new Error(
          `Attempted to construct a ${this.code} ` +
          `warning without a source range.`);
    }
    if (!this._parsedDocument) {
      throw new Error(
          `Attempted to construct a ${this.code} ` +
          `warning without a parsed document.`);
    }
  }

  toString(options: Partial<WarningStringifyOptions> = {}): string {
    const opts:
        WarningStringifyOptions = {...defaultPrinterOptions, ...options};
    const colorize = opts.color ? this._severityToColorFunction(this.severity) :
                                  (s: string) => s;
    const severity = this._severityToString(colorize);

    let result = '';
    if (options.verbosity !== 'one-line') {
      const underlined =
          underlineCode(this.sourceRange, this._parsedDocument, colorize);
      if (underlined) {
        result += underlined;
      }
      if (options.verbosity === 'code-only') {
        return result;
      }
      result += '\n\n';
    }

    result +=
        (`${this.sourceRange.file}` +
         `(${this.sourceRange.start.line},${this.sourceRange.start.column}) ` +
         `${severity} [${this.code}] - ${this.message}\n`);

    return result;
  }

  private _severityToColorFunction(severity: Severity) {
    switch (severity) {
      case Severity.ERROR:
        return chalk.red;
      case Severity.WARNING:
        return chalk.yellow;
      case Severity.INFO:
        return chalk.green;
      default:
        const never: never = severity;
        throw new Error(
            `Unknown severity value - ${never}` +
            ` - encountered while printing warning.`);
    }
  }

  private _severityToString(colorize: (s: string) => string) {
    switch (this.severity) {
      case Severity.ERROR:
        return colorize('error');
      case Severity.WARNING:
        return colorize('warning');
      case Severity.INFO:
        return colorize('info');
      default:
        const never: never = this.severity;
        throw new Error(
            `Unknown severity value - ${never} - ` +
            `encountered while printing warning.`);
    }
  }

  toJSON() {
    return {
      code: this.code,
      message: this.message,
      severity: this.severity,
      sourceRange: this.sourceRange,
    };
  }
}

export enum Severity {
  ERROR,
  WARNING,
  INFO
}

// TODO(rictic): can we get rid of this class entirely?
export class WarningCarryingException extends Error {
  readonly warning: Warning;
  constructor(warning: Warning) {
    super(warning.message);
    this.warning = warning;
  }
}

export type Verbosity = 'one-line' | 'full' | 'code-only';

export interface WarningStringifyOptions {
  readonly verbosity: Verbosity;
  readonly color: boolean;
}
const defaultPrinterOptions = {
  verbosity: 'full' as 'full',
  color: true
};
