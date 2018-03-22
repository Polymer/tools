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

import {Analyzer, Severity, Warning, WarningPrinter} from '../index';
import {createForDirectory} from '../test/test-utils';

/**
 * A basic demo of a linter CLI using the Analyzer API.
 */
async function main() {
  const basedir = process.cwd();
  const {analyzer} = await createForDirectory(basedir);
  const warnings = await getWarnings(analyzer, process.argv[2]);
  const warningPrinter = new WarningPrinter(process.stderr);
  await warningPrinter.printWarnings(warnings);
  const worstSeverity = Math.min.apply(Math, warnings.map((w) => w.severity));
  if (worstSeverity === Severity.ERROR) {
    process.exit(1);
  }
};

async function getWarnings(
    analyzer: Analyzer, localPath: string): Promise<Warning[]> {
  const result = (await analyzer.analyze([localPath])).getDocument(localPath);
  if (result.successful) {
    return result.value.getWarnings({imported: false});
  } else if (result.error !== undefined) {
    return [result.error];
  } else {
    return [];
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
