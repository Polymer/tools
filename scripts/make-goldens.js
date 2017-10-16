#!/usr/bin/env node

/**
 * @license
 * Copyright (c) 2017 The Polymer Project Authors. All rights reserved.
 * This code may only be used under the BSD style license found at
 * http://polymer.github.io/LICENSE.txt The complete set of authors may be found
 * at http://polymer.github.io/AUTHORS.txt The complete set of contributors may
 * be found at http://polymer.github.io/CONTRIBUTORS.txt Code distributed by
 * Google as part of the polymer project is also subject to an additional IP
 * rights grant found at http://polymer.github.io/PATENTS.txt
 */

/**
 * This script should be run from `npm run test:make-goldens`. It runs the
 * TypeScript declarations generator across all repos in the
 * `test/src/fixtures` directory, and writes the output to
 * `test/src/goldens/<fixture>/expected.d.ts`. The results of this script
 * *should* be checked in.
 */

const fs = require('fs');
const path = require('path');
const rimraf = require('rimraf');
const {generateDeclarations} = require('../lib/gen-ts');

const fixturesDir = path.join(__dirname, '..', 'src', 'test', 'fixtures');
const goldensDir = path.join(__dirname, '..', 'src', 'test', 'goldens');

rimraf.sync(goldensDir);
fs.mkdirSync(goldensDir);

for (const dir of fs.readdirSync(fixturesDir)) {
  generateDeclarations(path.join(fixturesDir, dir)).then((declarations) => {
    const outDir = path.join(goldensDir, dir);
    fs.mkdirSync(outDir);
    fs.writeFileSync(path.join(outDir, 'expected.d.ts'), declarations);
  });
}
