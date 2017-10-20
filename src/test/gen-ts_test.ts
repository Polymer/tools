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

import {assert} from 'chai';
import * as fs from 'fs';
import * as glob from 'glob';
import * as path from 'path';

import {generateDeclarations} from '../gen-ts';

const fixtures = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures');
const goldens = path.join(__dirname, '..', '..', 'src', 'test', 'goldens');

suite('generateDeclarations', () => {
  for (const fixture of fs.readdirSync(goldens)) {
    test(fixture, async () => {
      const actual = await generateDeclarations(path.join(fixtures, fixture));
      const golden = readDirAsMap(path.join(goldens, fixture));
      (assert as any).hasAllKeys(actual, [...golden.keys()]);
      for (const filename of actual.keys()) {
        assert.equal(actual.get(filename), golden.get(filename), filename);
      }
    }).timeout(30000);  // These tests can take a long time.
  }
});

function readDirAsMap(dir: string): Map<string, string> {
  const files = new Map<string, string>();
  for (const filename of glob.sync('**', {cwd: dir, nodir: true})) {
    files.set(filename, fs.readFileSync(path.join(dir, filename)).toString());
  }
  return files;
}
