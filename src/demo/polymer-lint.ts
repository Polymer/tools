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

import {Analyzer, Document, FSUrlLoader, PackageUrlResolver, Severity, Warning, WarningPrinter} from '../index';

/**
 * A basic demo of a linter CLI using the Analyzer API.
 */
async function main() {
  const basedir = process.cwd();
  const analyzer = new Analyzer({
    urlLoader: new FSUrlLoader(basedir),
    urlResolver: new PackageUrlResolver()
  });
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
  if (result instanceof Document) {
    return result.getWarnings({imported: false});
  } else if (result !== undefined) {
    return [result];
  } else {
    return [];
  }
}

main().catch((err) => {
  console.error(err.stack || err.message || err);
  process.exit(1);
});
