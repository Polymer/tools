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

import {Analyzer} from '../core/analyzer';
import {ParsedDocument} from '../parser/document';
import {underlineCode} from '../warning/code-printer';

import {Analysis} from './analysis';
import {Document} from './document';
import {comparePositionAndRange, isPositionInsideRange, SourceRange} from './source-range';

import stable = require('stable');

export interface WarningInit {
  readonly message: string;
  readonly sourceRange: SourceRange;
  readonly severity: Severity;
  readonly code: string;
  readonly parsedDocument: ParsedDocument;
  readonly fix?: Edit;
  readonly actions?: ReadonlyArray<Action>;
}
export class Warning {
  readonly code: string;
  readonly message: string;
  readonly sourceRange: SourceRange;
  readonly severity: Severity;

  /**
   * If the problem has a single automatic fix, this is it.
   *
   * Whether and how much something is 'automatic' can be a bit tricky to
   * delineate. Roughly speaking, if 99% of the time the change solves the
   * issue completely then it should go in `fix`.
   */
  readonly fix: Edit|undefined;

  /**
   * Other actions that could be taken in response to this warning.
   *
   * Each action is separate and they may be mutually exclusive. In the case
   * of edit actions they often are.
   */
  readonly actions: ReadonlyArray<Action>|undefined = undefined;
  private readonly _parsedDocument: ParsedDocument;

  constructor(init: WarningInit) {
    ({
      message: this.message,
      sourceRange: this.sourceRange,
      severity: this.severity,
      code: this.code,
      parsedDocument: this._parsedDocument,
    } = init);
    this.fix = init.fix;
    this.actions = init.actions;

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
         `(${this.sourceRange.start.line + 1},${
             this.sourceRange.start.column + 1}) ` +
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

export type Verbosity = 'one-line'|'full'|'code-only';

export interface WarningStringifyOptions {
  readonly verbosity: Verbosity;
  readonly color: boolean;
}
const defaultPrinterOptions = {
  verbosity: 'full' as 'full',
  color: true
};


export type Action = EditAction|{
  /** To ensure that type safe code actually checks for the action kind. */
  kind: 'never';
};

/**
 * An EditAction is like a fix, only it's not applied automatically when the
 * user runs `polymer lint --fix`. Often this is because it's less safe to
 * apply automatically, and there may be caveats, or multiple ways to resolve
 * the warning.
 *
 * For example, a change to an element that updates it to no longer use a
 * deprecated feature, but that involves a change in the element's API should
 * not be a fix, but should instead be an EditAction.
 */
export interface EditAction {
  kind: 'edit';
  /**
   * A unique string code for the edit action. Useful so that the user can
   * request that all actions with a given code should be applied.
   */
  code: string;
  /**
   * A short description of the change, noting caveats and important information
   * for the user.
   */
  description: string;
  edit: Edit;
}

/**
 * Represents an action for replacing a range in a document with some text.
 *
 * This is sufficient to represent all operations on text files, including
 * inserting and deleting text (using empty ranges or empty replacement
 * text, respectively).
 */
export interface Replacement {
  readonly range: SourceRange;
  readonly replacementText: string;
}


/**
 * A set of replacements that must all be applied as a single atomic unit.
 */
export type Edit = ReadonlyArray<Replacement>;

export interface EditResult {
  /** The edits that had no conflicts, and are reflected in editedFiles. */
  appliedEdits: Edit[];

  /** Edits that could not be applied due to overlapping ranges. */
  incompatibleEdits: Edit[];

  /** A map from urls to their new contents. */
  editedFiles: Map<string, string>;
}

/**
 * Takes the given edits and, provided there are no overlaps, applies them to
 * the contents loadable from the given loader.
 *
 * If there are overlapping edits, then edits earlier in the array get priority
 * over later ones.
 */
export async function applyEdits(
    edits: Edit[], loader: (url: string) => Promise<ParsedDocument<any, any>>):
    Promise<EditResult> {
  const result: EditResult = {
    appliedEdits: [],
    incompatibleEdits: [],
    editedFiles: new Map()
  };

  const replacementsByFile = new Map<string, Replacement[]>();
  for (const edit of edits) {
    if (canApply(edit, replacementsByFile)) {
      result.appliedEdits.push(edit);
    } else {
      result.incompatibleEdits.push(edit);
    }
  }

  for (const [file, replacements] of replacementsByFile) {
    const document = await loader(file);
    let contents = document.contents;
    /**
     * This is the important bit. We know that none of the replacements overlap,
     * so in order for their source ranges in the file to all be valid at the
     * time we apply them, we simply need to apply them starting from the end
     * of the document and working backwards to the beginning.
     *
     * To preserve ordering of insertions to the same position, we use a stable
     * sort.
     */
    stable.inplace(replacements, (a, b) => {
      const leftEdgeComp =
          comparePositionAndRange(b.range.start, a.range, true);
      if (leftEdgeComp !== 0) {
        return leftEdgeComp;
      }
      return comparePositionAndRange(b.range.end, a.range, false);
    });
    for (const replacement of replacements) {
      const offsets = document.sourceRangeToOffsets(replacement.range);
      contents = contents.slice(0, offsets[0]) + replacement.replacementText +
          contents.slice(offsets[1]);
    }
    result.editedFiles.set(file, contents);
  }

  return result;
}

/**
 * We can apply an edit if none of its replacements overlap with any accepted
 * replacement.
 */
function canApply(
    edit: Edit, replacements: Map<string, Replacement[]>): boolean {
  for (let i = 0; i < edit.length; i++) {
    const replacement = edit[i];
    const fileLocalReplacements =
        replacements.get(replacement.range.file) || [];
    // TODO(rictic): binary search
    for (const acceptedReplacement of fileLocalReplacements) {
      if (!areReplacementsCompatible(replacement, acceptedReplacement)) {
        return false;
      }
    }
    // Also check consistency between multiple replacements in this edit.
    for (let j = 0; j < i; j++) {
      const acceptedReplacement = edit[j];
      if (!areReplacementsCompatible(replacement, acceptedReplacement)) {
        return false;
      }
    }
  }

  // Ok, we can be applied to the replacements, so add our replacements in.
  for (const replacement of edit) {
    if (!replacements.has(replacement.range.file)) {
      replacements.set(replacement.range.file, [replacement]);
    } else {
      const fileReplacements = replacements.get(replacement.range.file)!;
      fileReplacements.push(replacement);
    }
  }
  return true;
}

function areReplacementsCompatible(a: Replacement, b: Replacement) {
  if (a.range.file !== b.range.file) {
    return true;
  }

  if (areRangesEqual(a.range, b.range)) {
    // Equal ranges are compatible if the ranges are empty (i.e. the edit is an
    // insertion, not a replacement).
    return (
        a.range.start.column === a.range.end.column &&
        a.range.start.line === a.range.end.line);
  }
  return !(
      isPositionInsideRange(a.range.start, b.range, false) ||
      isPositionInsideRange(a.range.end, b.range, false) ||
      isPositionInsideRange(b.range.start, a.range, false) ||
      isPositionInsideRange(b.range.end, a.range, false));
}

function areRangesEqual(a: SourceRange, b: SourceRange) {
  return a.start.line === b.start.line && a.start.column === b.start.column &&
      a.end.line === b.end.line && a.end.column === b.end.column;
}

export function makeParseLoader(analyzer: Analyzer, analysis?: Analysis) {
  return async (url: string) => {
    if (analysis) {
      const cachedResult = analysis.getDocument(url);
      if (cachedResult instanceof Document) {
        return cachedResult.parsedDocument;
      }
    }
    const result = (await analyzer.analyze([url])).getDocument(url);
    if (result instanceof Document) {
      return result.parsedDocument;
    }
    throw new Error(`Cannot load file at:  ${url}`);
  };
}
