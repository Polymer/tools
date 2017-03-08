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

import {Analyzer, Document, Severity, Warning, WarningCarryingException} from 'polymer-analyzer';

import {Rule} from './rule';

export {registry} from './registry';
export {Rule, RuleCollection} from './rule';

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
  public async lint(files: string[]): Promise<Warning[]> {
    const analysisResult = await this._analyzeAll(files);
    const documents = analysisResult.documents;
    let analysisWarnings = analysisResult.warnings;
    for (const document of documents) {
      analysisWarnings = analysisWarnings.concat(document.getWarnings());
    }
    return analysisWarnings.concat(await this._lintDocuments(documents));
  }

  public async lintPackage(): Promise<Warning[]> {
    const pckage = await this._analyzer.analyzePackage();
    const analysisWarnings = pckage.getWarnings();
    const warnings = await this._lintDocuments(pckage.getByKind('document'));
    return analysisWarnings.concat(warnings);
  }

  private async _lintDocuments(documents: Iterable<Document>) {
    let warnings: Warning[] = [];
    for (const document of documents) {
      for (const rule of this._rules) {
        try {
          warnings = warnings.concat(await rule.check(document));
        } catch (e) {
          warnings.push(this._getWarningFromError(
              e,
              document.url,
              'internal-lint-error',
              `Internal error during linting: ${e ? e.message : e}`));
        }
      }
    }
    return warnings;
  }

  private async _analyzeAll(files: string[]) {
    const documents = [];
    const warnings: Warning[] = [];
    for (const file of files) {
      try {
        documents.push(await this._analyzer.analyze(file));
      } catch (e) {
        warnings.push(this._getWarningFromError(
            e,
            file,
            'unable-to-analyze-file',
            `Internal Error while analyzing: ${e ? e.message : e}`));
      }
    }

    return {documents, warnings};
  }

  private _getWarningFromError(
      e: any, file: string, code: string, message: string) {
    if (e instanceof WarningCarryingException) {
      return e.warning;
    }
    return {
      code,
      message,
      severity: Severity.WARNING,
      sourceRange:
          {file, start: {line: 0, column: 0}, end: {line: 0, column: 0}}
    };
  }
}
