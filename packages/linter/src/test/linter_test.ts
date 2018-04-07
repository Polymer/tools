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
import * as path from 'path';
import {Analyzer, Document, Severity, Warning} from 'polymer-analyzer';
import {ProjectConfig} from 'polymer-project-config';

import {Linter} from '../linter';
import {Rule} from '../rule';

import {WarningPrettyPrinter} from './util';

const fixtures_dir = path.resolve(path.join(__dirname, '../../test'));

class AlwaysWarnsRule extends Rule {
  readonly code = 'always-warn-rule';
  readonly description = 'Always warns, for every file';
  async check(document: Document): Promise<Warning[]> {
    return [new Warning({
      parsedDocument: document.parsedDocument,
      code: this.code,
      message: this.description,
      severity: Severity.WARNING,
      sourceRange: {
        file: document.url,
        start: {line: 0, column: 0},
        end: {line: 0, column: 0}
      }
    })];
  }
}

suite('Linter', () => {

  suite('.lint', () => {
    let analyzer: Analyzer;
    let warningPrinter: WarningPrettyPrinter;

    setup(async() => {
      ({analyzer} =
           await ProjectConfig.initializeAnalyzerFromDirectory(fixtures_dir));
      warningPrinter = new WarningPrettyPrinter();
    });

    test('works in the trivial case', async() => {
      const linter = new Linter([], analyzer);
      const {warnings} = await linter.lint([]);
      assert.deepEqual([...warnings], []);
    });

    test('gives no warnings for a perfectly fine file', async() => {
      const linter = new Linter([], analyzer);
      const {warnings} =
          await linter.lint(['perfectly-fine/polymer-element.html']);
      assert.deepEqual([...warnings], []);
    });

    test('surfaces warnings up from the analyzer', async() => {
      // Even without any rules we still get the warnings from the analyzer.
      const linter = new Linter([], analyzer);
      const {warnings} =
          await linter.lint(['missing-imports/missing-imports.html']);
      assert.deepEqual(warningPrinter.prettyPrint(warnings), [
        `
<link rel="import" href="./does-not-exist.html">
                        ~~~~~~~~~~~~~~~~~~~~~~~`,
        `
<link rel="import" href="./also-does-not-exist.html">
                        ~~~~~~~~~~~~~~~~~~~~~~~~~~~~`
      ]);
    });

    const testName =
        'when linting a package, do not surface warnings from external files';
    test(testName, async() => {
      const dir = path.join(fixtures_dir, 'package-external');
      const {analyzer} =
          await ProjectConfig.initializeAnalyzerFromDirectory(dir);
      const linter = new Linter([new AlwaysWarnsRule()], analyzer);
      const {warnings} = await linter.lintPackage();
      // One warning from the analyzer, one from the AlwaysWarns, both in
      // index, none from bower_components/external.html
      assert.deepEqual(
          warnings.map((w) => w.sourceRange.file),
          ['index.html', 'index.html'].map((u) => analyzer.resolveUrl(u)));

      const {warnings: alsoWarnings} = await linter.lint(['index.html']);
      assert.deepEqual(alsoWarnings, warnings);

      const {warnings: allWarnings} =
          await linter.lint(['index.html', 'bower_components/external.html']);
      assert.deepEqual(allWarnings.map((w) => w.sourceRange.file).sort(), [
        'index.html',
        'index.html',
        'bower_components/external.html',
        'bower_components/external.html'
      ].map((u) => analyzer.resolveUrl(u)).sort());
    });
  });
});
