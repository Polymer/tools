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
const fsExtra = require('fs-extra');
const path = require('path');

const {generateDeclarations} = require('../lib/gen-ts');

const fixturesDir = path.join(__dirname, '..', 'src', 'test', 'fixtures');
const goldensDir = path.join(__dirname, '..', 'src', 'test', 'goldens');

fsExtra.emptyDir(goldensDir);

for (const fixture of fs.readdirSync(fixturesDir)) {
  console.log('making goldens for ' + fixture);
  generateDeclarations(path.join(fixturesDir, fixture)).then((declarations) => {
    for (const [filename, contents] of declarations) {
      const outPath = path.join(goldensDir, fixture, filename);
      fsExtra.mkdirsSync(path.dirname(outPath));
      fs.writeFileSync(outPath, contents);
    };
  });
}
