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

import './collections';

import {CancelToken} from 'cancel-token';
import {Analysis, Analyzer, Document, ParsedDocument, ResolvedUrl, Severity, Warning, WarningCarryingException} from 'polymer-analyzer';

import {AnalyzeOptions} from 'polymer-analyzer/lib/core/analyzer';
import {MinimalCancelToken} from 'polymer-analyzer/lib/core/cancel-token';

import {Rule} from './rule';

export {registry} from './registry';
export {Rule, RuleCollection} from './rule';

const {token: neverCancels} = CancelToken.source();

/**
 * The Linter is a simple class which groups together a set of Rules and applies
 * them to a set of file urls which can be resolved and loaded by the provided
 * Analyzer.  A default Analyzer is prepared if one is not provided.
 */
export class Linter {
  private _analyzer: Analyzer;
  private _rules: Rule[];

  constructor(rules: Iterable<Rule>, analyzer: Analyzer) {
    this._analyzer = analyzer;
    this._rules = Array.from(rules);
  }

  /**
   * Given an array of filenames, lint the files and return an array of all
   * warnings produced evaluating the linter rules.
   */
  public async lint(files: string[], options: AnalyzeOptions = {}):
      Promise<LintResult> {
    const {documents, warnings, analysis} =
        await this._analyzeAll(files, options);
    for (const document of documents) {
      warnings.push(...document.getWarnings());
    }
    return makeLintResult(
        warnings.concat(
            ...await this._lintDocuments(documents, options.cancelToken)),
        analysis);
  }

  public async lintPackage(options: AnalyzeOptions = {}): Promise<LintResult> {
    const analysis = await this._analyzer.analyzePackage(options);
    const warnings = analysis.getWarnings();
    warnings.push(...await this._lintDocuments(
        analysis.getFeatures({kind: 'document'}), options.cancelToken));
    return makeLintResult(warnings, analysis);
  }

  private async _lintDocuments(
      documents: Iterable<Document>,
      cancelToken: MinimalCancelToken = neverCancels) {
    const warnings: Warning[] = [];
    for (const document of documents) {
      if (document.isInline) {
        // We lint the toplevel documents. If a rule wants to check inline
        // documents, it can. getFeatures makes that pretty easy.
        continue;
      }
      for (const rule of this._rules) {
        cancelToken.throwIfRequested();
        try {
          warnings.push(...await rule.cachedCheck(document));
        } catch (e) {
          warnings.push(this._getWarningFromError(
              document.parsedDocument,
              e,
              document.url,
              'internal-lint-error',
              `Internal error during linting: ${e ? e.message : e}`));
        }
      }
    }
    return warnings;
  }

  private async _analyzeAll(files: string[], options?: AnalyzeOptions) {
    const analysis = await this._analyzer.analyze(files, options);
    const documents = [];
    const warnings = [];

    for (const file of files) {
      const result = analysis.getDocument(file);
      if (result.successful) {
        documents.push(result.value);
      } else if (result.error !== undefined) {
        warnings.push(result.error);
      }
    }

    return {documents, warnings, analysis};
  }

  private _getWarningFromError(
      parsedDocument: ParsedDocument, e: {}, file: ResolvedUrl, code: string,
      message: string) {
    if (e instanceof WarningCarryingException) {
      return e.warning;
    }
    return new Warning({
      parsedDocument,
      code,
      message,
      severity: Severity.WARNING,
      sourceRange:
          {file, start: {line: 0, column: 0}, end: {line: 0, column: 0}}
    });
  }
}

/**
 * We want to return both the warnings and the immutable analysis we used as
 * its basis. This is slightly hacky, but it has better back-compat.
 *
 * Fix with the next major version.
 */
export interface LintResult {
  readonly warnings: ReadonlyArray<Warning>;
  readonly analysis: Analysis;
}

function makeLintResult(
    warnings: ReadonlyArray<Warning>, analysis: Analysis): LintResult {
  return {warnings, analysis};
}
