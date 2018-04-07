/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
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

import {assert} from 'chai';
import {Analyzer, applyEdits, EditResult, makeParseLoader, Warning} from 'polymer-analyzer';

import {Linter} from '../linter';

export class WarningPrettyPrinter {
  prettyPrint(warnings: ReadonlyArray<Warning>): string[] {
    return warnings.map(
        (w) => '\n' + w.toString({verbosity: 'code-only', color: false}));
  }
}

/**
 * Assert that applying all fixes to the given input file results in
 * the given golden output file.
 */
export async function assertExpectedFixes(
    linter: Linter, analyzer: Analyzer, inputFile: string, goldenFile: string) {
  const {warnings} = await linter.lint([inputFile]);
  const edits = warnings.filter((w) => w.fix).map((w) => w.fix!);
  const loader = makeParseLoader(analyzer);
  const {editedFiles, incompatibleEdits} = await applyEdits(edits, loader);
  assert.deepEqual(incompatibleEdits, []);
  const inputFileContent = editedFiles.get(analyzer.resolveUrl(inputFile)!);
  const outputFileContent =
      (await loader(analyzer.resolveUrl(goldenFile)!)).contents;
  assert.deepEqual(inputFileContent, outputFileContent);
}

/**
 * Assert that applying the given edit result modifies the given input file
 * and results in the contents of the given golden output file.
 *
 * Like assertExpectedFixes, but can also test edit actions.
 */
export async function assertFileEdited(
    analyzer: Analyzer,
    editResult: EditResult,
    inputFile: string,
    goldenFile: string) {
  assert.deepEqual(
      editResult.editedFiles.get(analyzer.resolveUrl(inputFile)!),
      (await analyzer.load(analyzer.resolveUrl(goldenFile)!)));
}
