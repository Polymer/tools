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
 * This script should be run from `npm run update-goldens`. It runs the
 * TypeScript declarations generator across all repos in the
 * `test/src/fixtures` directory, and writes the output to
 * `test/src/goldens/<fixture>/expected.d.ts`. The results of this script
 * *should* be checked in.
 */

// TODO Rewrite in typescript.

const fs = require('fs');
const fsExtra = require('fs-extra');
const path = require('path');

const {generateDeclarations} = require('../lib/gen-ts');

const fixturesDir = path.join(__dirname, '..', 'src', 'test', 'fixtures');
const goldensDir = path.join(__dirname, '..', 'src', 'test', 'goldens');

const filter = process.env.UPDATE_GOLDENS_FILTER || '';

if (!filter) {
  fsExtra.emptyDirSync(goldensDir);
}

for (const fixture of fs.readdirSync(fixturesDir)) {
  if (filter && !fixture.includes(filter)) {
    continue;
  }
  console.log('making goldens for ' + fixture);
  fsExtra.emptyDirSync(path.join(goldensDir, fixture));

  let config = {};
  const configPath = path.join(fixturesDir, fixture, 'gen-tsd.json');
  if (fs.existsSync(configPath)) {
    config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }

  generateDeclarations(path.join(fixturesDir, fixture), config)
      .then((declarations) => {
        for (const [filename, contents] of declarations) {
          const outPath = path.join(goldensDir, fixture, filename);
          fsExtra.mkdirsSync(path.dirname(outPath));
          fs.writeFileSync(outPath, contents);
        };
      });
}
