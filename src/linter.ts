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

import {Analyzer, Document, ParsedDocument, Severity, Warning, WarningCarryingException} from 'polymer-analyzer';

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
    const {documents, warnings} = await this._analyzeAll(files);
    for (const document of documents) {
      warnings.push(...document.getWarnings());
    }
    return warnings.concat(...await this._lintDocuments(documents));
  }

  public async lintPackage(): Promise<Warning[]> {
    const pckage = await this._analyzer.analyzePackage();
    const warnings = pckage.getWarnings();
    warnings.push(
        ...await this._lintDocuments(pckage.getFeatures({kind: 'document'})));
    return warnings;
  }

  private async _lintDocuments(documents: Iterable<Document>) {
    const warnings: Warning[] = [];
    for (const document of documents) {
      for (const rule of this._rules) {
        try {
          warnings.push(...await rule.check(document));
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

  private async _analyzeAll(files: string[]) {
    const analysis = await this._analyzer.analyze(files);
    const documents = [];
    const warnings = [];

    for (const file of files) {
      const result = analysis.getDocument(this._analyzer.resolveUrl(file));
      if (!result) {
        continue;
      } else if (result instanceof Document) {
        documents.push(result);
      } else {
        warnings.push(result);
      }
    }

    return {documents, warnings};
  }

  private _getWarningFromError(
      parsedDocument: ParsedDocument<any, any>, e: any, file: string,
      code: string, message: string) {
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
