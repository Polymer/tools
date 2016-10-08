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

import {Analyzer} from '../analyzer';
import {SourceRange} from '../model/source-range';

import {Severity, Warning} from './warning';

export type Verbosity = 'one-line' | 'full';

export interface Options {
  analyzer: Analyzer;
  verbosity?: Verbosity;
  color?: boolean;
}

const defaultPrinterOptions = {
  verbosity: 'full',
  color: true
};

export class WarningPrinter {
  _chalk: chalk.Chalk;
  private _options: Options;

  constructor(private _outStream: NodeJS.WritableStream, _options?: Options) {
    this._options =
        Object.assign({}, defaultPrinterOptions, _options) as Options;
    this._chalk = new chalk.constructor({enabled: !!this._options.color});
  }

  /**
   * Convenience method around `printWarning`.
   */
  async printWarnings(warnings: Iterable<Warning>) {
    for (const warning of warnings) {
      await this.printWarning(warning);
    }
  }

  async printWarning(warning: Warning) {
    const severity = this._severityToString(warning.severity);
    const range = warning.sourceRange;

    if (this._options.verbosity === 'full') {
      this._outStream.write('\n');
      this._outStream.write(
          await this.getUnderlinedText(range, warning.severity) + '\n\n');
    }

    this._outStream.write(
        `${range.file}` +
        `(${range.start.line},${range.start.column}) ` +
        `${severity} [${warning.code}] - ${warning.message}\n`);
  }

  private _severityToString(severity: Severity) {
    const colorFunction = this._severityToColorFunction(severity);
    switch (severity) {
      case Severity.ERROR:
        return colorFunction('error');
      case Severity.WARNING:
        return colorFunction('warning');
      case Severity.INFO:
        return colorFunction('info');
      default:
        const never: never = severity;
        throw new Error(`Unknown severity value - ${never
                        } - encountered while printing warning.`);
    }
  }

  async getUnderlinedText(range: SourceRange, severity?: Severity) {
    const colorFunction = severity == null ?
        (v: string) => v :
        this._severityToColorFunction(severity);

    const lines = await this._getLinesOfText(
        range.start.line, range.end.line, range.file);
    const outputLines: string[] = [];
    let lineNum = range.start.line;
    for (const line of lines) {
      outputLines.push(line);
      outputLines.push(
          colorFunction(getSquiggleUnderline(line, lineNum, range)));
      lineNum++;
    }
    return outputLines.join('\n');
  }

  private _severityToColorFunction(severity: Severity) {
    switch (severity) {
      case Severity.ERROR:
        return this._chalk.red;
      case Severity.WARNING:
        return this._chalk.yellow;
      case Severity.INFO:
        return this._chalk.green;
      default:
        const never: never = severity;
        throw new Error(
            `Unknown severity value - ${never}` +
            ` - encountered while printing warning.`);
    }
  }

  private async _getLinesOfText(
      startLine: number, endLine: number, localPath: string) {
    const contents = await this._options.analyzer.load(localPath);
    return contents.split('\n').slice(startLine, endLine + 1);
  }
}

function getSquiggleUnderline(
    lineText: string, lineNum: number, sourceRange: SourceRange) {
  // We're on a middle line of a multiline range. Squiggle the entire line.
  if (lineNum !== sourceRange.start.line && lineNum !== sourceRange.end.line) {
    return '~'.repeat(lineText.length);
  }
  // The tricky case. Might be the start of a multiline range, or it might just
  // be a one-line range.
  if (lineNum === sourceRange.start.line) {
    const startColumn = sourceRange.start.column;
    const endColumn = sourceRange.end.line === sourceRange.start.line ?
        sourceRange.end.column :
        lineText.length;
    const prefix = ' '.repeat(startColumn);
    if (startColumn === endColumn) {
      return prefix + '~';  // always draw at least one squiggle
    }
    return prefix + '~'.repeat(endColumn - startColumn);
  }

  // We're on the end line of a multiline range. Just squiggle up to the end
  // column.
  return '~'.repeat(sourceRange.end.column);
}
